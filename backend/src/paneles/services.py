"""Indicadores agregados de los paneles de categoría.

Regla del módulo: todo lo que se devuelve sale de datos guardados. Si un
indicador no se puede calcular (no hubo tareas, no se cerró ningún incidente)
va `None`, nunca un cero inventado. Las consultas agrupan en la base y solo
traen filas completas cuando son listas cortas de "qué pide atención".
"""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Iterable, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from src.aptitud.models import Aptitud  # noqa: F401  (registro de modelos)
from src.certificaciones_transportista.models import CertificacionTransportista
from src.checklist.models import Checklist, EstadoChecklist, RegistroTarea
from src.checklist.services.tareas_del_dia import listar_tareas_del_dia
from src.clientes.models import Cliente
from src.common.estado_documento import PROXIMO, VENCIDO, estado_documento
from src.common.fechas import hoy
from src.elementoLimpieza.models import ElementoLimpieza
from src.Equipo.models import Calibracion, Equipo
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.incidente.models import Incidente
from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico
from src.insumos.models import Insumo
from src.lotes.constants import (
    ESTADO_CANCELADO,
    ESTADO_EN_PROCESO,
    ESTADO_TERMINADO,
    ESTADOS_LOTE,
    TIPO_CONSUMO_DESPERDICIO,
    TIPO_CONSUMO_REAL,
)
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo import services as lotes_insumo_services
from src.lotesInsumo.models import LoteInsumo
from src.notificaciones.services import MARGEN_DIAS_ALERTA, obtener_meta_cumplimiento_limpieza
from src.nutricion.models import InfoNutricionalProducto
from src.paneles import schemas
from src.paneles.constants import (
    DIAS_POR_VENCER,
    ETIQUETA_ESTADO_CHECKLIST,
    ETIQUETA_ESTADO_LOTE,
    ETIQUETA_ESTADO_SALIDA,
    ETIQUETA_MOMENTO_TAREA,
    ETIQUETA_TIPO_INCIDENTE,
    ETIQUETA_TIPO_INSUMO,
    ETIQUETA_TIPO_VENCIMIENTO,
    FILAS_LISTA,
    FILAS_RANKING,
    MAXIMO_DIAS_PERIODO,
    MAXIMO_DIAS_POR_DIA,
    MAXIMO_DIAS_POR_SEMANA,
    MESES,
)
from src.paneles.exceptions import PeriodoDemasiadoLargo, RangoFechasInvalido
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.PlanLimpieza.models import PlanLimpieza
from src.productos.models import Producto
from src.proveedores.models import CertificacionProveedor, Proveedor
from src.recetas.models import Receta, VersionReceta
from src.reclamos.constants import ETIQUETAS_MOTIVO_RECLAMO, MOTIVOS_RECLAMO
from src.reclamos.models import Reclamo
from src.retiros.constants import ESTADO_RETIRO_EN_CURSO
from src.retiros.models import Retiro
from src.rotulado.constants import ESTADO_COMPLETADO
from src.rotulado.models import BorradorRotulado
from src.salidas.constants import ESTADO_RECHAZADA, ESTADOS_SALIDA
from src.salidas.models import Salida, formatear_cantidad
from src.sector.models import Sector
from src.tareas.models import Tarea
from src.transportistas.models import Transportista
from src.unidadMedida.constants import TIPO_MASA, TIPO_UNIDAD, TIPO_VOLUMEN
from src.unidadMedida.models import UnidadMedida
from src.vencimientos import services as vencimientos_services

# ─────────────────────────── Período y series ───────────────────────────


def validar_periodo(desde: date, hasta: date) -> schemas.Periodo:
    if desde > hasta:
        raise RangoFechasInvalido()
    if (hasta - desde).days + 1 > MAXIMO_DIAS_PERIODO:
        raise PeriodoDemasiadoLargo()
    return schemas.Periodo(desde=desde, hasta=hasta)


def _desde_dt(dia: date) -> datetime:
    return datetime.combine(dia, time.min)


def _hasta_dt(dia: date) -> datetime:
    """Límite superior EXCLUYENTE para columnas con hora."""
    return datetime.combine(dia + timedelta(days=1), time.min)


def _en_periodo(columna, periodo: schemas.Periodo, con_hora: bool):
    """Condiciones para que `columna` caiga dentro del período."""
    if con_hora:
        return (columna >= _desde_dt(periodo.desde), columna < _hasta_dt(periodo.hasta))
    return (columna >= periodo.desde, columna <= periodo.hasta)


def _granularidad(periodo: schemas.Periodo) -> schemas.Granularidad:
    dias = (periodo.hasta - periodo.desde).days + 1
    if dias <= MAXIMO_DIAS_POR_DIA:
        return "dia"
    if dias <= MAXIMO_DIAS_POR_SEMANA:
        return "semana"
    return "mes"


def _inicio_tramo(dia: date, granularidad: str) -> date:
    if granularidad == "semana":
        return dia - timedelta(days=dia.weekday())
    if granularidad == "mes":
        return dia.replace(day=1)
    return dia


def _siguiente_tramo(inicio: date, granularidad: str) -> date:
    if granularidad == "semana":
        return inicio + timedelta(days=7)
    if granularidad == "mes":
        return (inicio.replace(day=28) + timedelta(days=4)).replace(day=1)
    return inicio + timedelta(days=1)


def _etiqueta_tramo(inicio: date, granularidad: str) -> str:
    if granularidad == "mes":
        return f"{MESES[inicio.month - 1]} {inicio:%y}"
    return f"{inicio.day}/{inicio.month}"


def _a_fecha(valor) -> date:
    """`func.date()` devuelve texto en SQLite y `date` en otros motores."""
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def _tramos(periodo: schemas.Periodo, granularidad: str) -> list[date]:
    tramos = []
    inicio = _inicio_tramo(periodo.desde, granularidad)
    while inicio <= periodo.hasta:
        tramos.append(inicio)
        inicio = _siguiente_tramo(inicio, granularidad)
    return tramos


def _serie(
    periodo: schemas.Periodo,
    claves: tuple[str, ...],
    filas: Iterable[tuple[object, str, float]],
) -> schemas.Serie:
    """Arma una serie de conteos: cada fila es (día, clave, cantidad).

    Todos los tramos del período aparecen, con cero donde no hubo nada: un
    hueco en el eje del tiempo se leería como "no hay datos" y acá es "no pasó".
    """
    granularidad = _granularidad(periodo)
    acumulado: dict[date, dict[str, float]] = {
        tramo: {clave: 0.0 for clave in claves} for tramo in _tramos(periodo, granularidad)
    }
    for dia, clave, cantidad in filas:
        tramo = _inicio_tramo(_a_fecha(dia), granularidad)
        if tramo in acumulado and clave in acumulado[tramo]:
            acumulado[tramo][clave] += float(cantidad or 0)
    return schemas.Serie(
        granularidad=granularidad,
        puntos=[
            schemas.PuntoSerie(
                clave=tramo, etiqueta=_etiqueta_tramo(tramo, granularidad), valores=valores
            )
            for tramo, valores in acumulado.items()
        ],
    )


def _mapa(
    periodo: schemas.Periodo,
    filas: list[tuple[str, str]],
    celdas: dict[tuple[str, date], Optional[float]],
    sin_dato: Optional[float],
) -> schemas.MapaCalor:
    """Arma un mapa de calor: `celdas` va por (clave de fila, inicio de tramo)."""
    granularidad = _granularidad(periodo)
    tramos = _tramos(periodo, granularidad)
    return schemas.MapaCalor(
        granularidad=granularidad,
        columnas=[_etiqueta_tramo(tramo, granularidad) for tramo in tramos],
        filas=[
            schemas.FilaMapa(
                clave=clave,
                etiqueta=etiqueta,
                valores=[celdas.get((clave, tramo), sin_dato) for tramo in tramos],
            )
            for clave, etiqueta in filas
        ],
    )


def _conteo_por_dia(db: Session, columna, clave: str, *condiciones, desde=None):
    """Filas (día, clave, cantidad) de una tabla, agrupadas por día."""
    dia = func.date(columna)
    consulta = select(dia, func.count()).where(*condiciones).group_by(dia)
    if desde is not None:
        consulta = consulta.select_from(desde)
    return [(d, clave, n) for d, n in db.execute(consulta).all()]


def _nombre_persona(nombre: str, apellido: Optional[str]) -> str:
    return f"{nombre} {apellido or ''}".strip()


def _porcentaje(parte: float, total: float) -> Optional[float]:
    return round(parte / total * 100, 1) if total else None


def _a_kilos(
    cantidad: Decimal,
    tipo: str | None,
    factor: float | None,
    peso_unidad_g: Decimal | None,
    densidad_g_ml: Decimal | None,
) -> Decimal | None:
    """Cantidad de producto en kg, o None si falta el dato para convertirla.

    El factor de la unidad lleva a gramos, mililitros o unidades sueltas (una
    docena son 12); de ahí, el peso por unidad o la densidad del producto.
    """
    if not tipo or not factor:
        return None
    base = cantidad * Decimal(str(factor))
    if tipo == TIPO_MASA:
        gramos = base
    elif tipo == TIPO_VOLUMEN and densidad_g_ml:
        gramos = base * Decimal(str(densidad_g_ml))
    elif tipo == TIPO_UNIDAD and peso_unidad_g:
        gramos = base * Decimal(str(peso_unidad_g))
    else:
        return None
    return gramos / 1000


def _plural(n: int, uno: str, muchos: str) -> str:
    return f"{n} {uno if n == 1 else muchos}"


def _plazo(dias: int) -> tuple[schemas.Tono, str]:
    """Estado de un plazo en palabras, igual en todos los paneles."""
    if dias < 0:
        return "peligro", f"Venció hace {_plural(-dias, 'día', 'días')}"
    if dias == 0:
        return "peligro", "Vence hoy"
    return ("alerta" if dias <= DIAS_POR_VENCER else "info"), f"Vence en {_plural(dias, 'día', 'días')}"


def _sectores(db: Session) -> list[schemas.Opcion]:
    return [
        schemas.Opcion(valor=str(sector_id), etiqueta=nombre)
        for sector_id, nombre in db.execute(
            select(Sector.id, Sector.nombre).where(Sector.activo.is_(True)).order_by(Sector.nombre)
        ).all()
    ]


# ───────────────────────────── Producción ─────────────────────────────


def _catalogo_produccion(db: Session) -> schemas.CatalogoProduccion:
    productos = db.execute(
        select(Producto.id, Producto.nombre).where(Producto.activo.is_(True)).order_by(Producto.nombre)
    ).all()
    ids = {producto_id for producto_id, _ in productos}

    con_receta = set(
        db.scalars(
            select(Receta.producto_id)
            .join(VersionReceta, VersionReceta.receta_id == Receta.id)
            .where(Receta.activo.is_(True))
            .distinct()
        ).all()
    )
    con_nutricion = set(db.scalars(select(InfoNutricionalProducto.producto_id)).all())
    con_rotulo = set(
        db.scalars(
            select(BorradorRotulado.producto_id)
            .where(BorradorRotulado.estado == ESTADO_COMPLETADO)
            .distinct()
        ).all()
    )

    requisitos = (
        ("receta", "Con receta", "receta", con_receta),
        ("nutricion", "Con información nutricional", "información nutricional", con_nutricion),
        ("rotulado", "Con rótulo completado", "rótulo", con_rotulo),
    )
    pendientes = []
    for producto_id, nombre in productos:
        falta = [texto for _, _, texto, conjunto in requisitos if producto_id not in conjunto]
        if falta:
            pendientes.append(
                schemas.FilaAtencion(
                    clave=f"producto-{producto_id}",
                    titulo=nombre,
                    detalle="Falta " + ", ".join(falta),
                    tono="peligro" if "receta" in falta else "alerta",
                    estado=_plural(len(falta), "pendiente", "pendientes"),
                    link="/productos",
                )
            )
    # Primero los que tienen más cosas sin completar.
    pendientes.sort(key=lambda fila: (-fila.detalle.count(",") if fila.detalle else 0, fila.titulo))

    return schemas.CatalogoProduccion(
        productos_activos=len(productos),
        avances=[
            schemas.Avance(clave=clave, etiqueta=etiqueta, cumplen=len(ids & conjunto), total=len(productos))
            for clave, etiqueta, _, conjunto in requisitos
        ],
        rotulado_pendiente=len(ids - con_rotulo),
        pendientes=pendientes[:FILAS_LISTA],
    )


def panel_produccion(
    db: Session,
    periodo: schemas.Periodo,
    producto_id: Optional[int],
    administra: bool,
) -> schemas.PanelProduccion:
    de_producto = () if producto_id is None else (LoteProducto.producto_id == producto_id,)

    en_proceso_total = db.scalar(
        select(func.count()).select_from(LoteProducto).where(
            LoteProducto.estado == ESTADO_EN_PROCESO, *de_producto
        )
    )

    # Lotes iniciados en el período, por día y por su estado actual.
    dia_inicio = func.date(LoteProducto.fecha_inicio)
    iniciados = db.execute(
        select(dia_inicio, LoteProducto.estado, func.count())
        .where(*_en_periodo(LoteProducto.fecha_inicio, periodo, True), *de_producto)
        .group_by(dia_inicio, LoteProducto.estado)
    ).all()
    por_estado = {estado: 0 for estado in ESTADOS_LOTE}
    for _, estado, cantidad in iniciados:
        por_estado[estado] = por_estado.get(estado, 0) + cantidad

    # Lotes cerrados en el período (terminados o cancelados), por día de cierre.
    dia_cierre = func.date(LoteProducto.fecha_cierre)
    cerrados = db.execute(
        select(dia_cierre, LoteProducto.estado, func.count())
        .where(
            LoteProducto.fecha_cierre.is_not(None),
            *_en_periodo(LoteProducto.fecha_cierre, periodo, True),
            *de_producto,
        )
        .group_by(dia_cierre, LoteProducto.estado)
    ).all()
    terminados = sum(n for _, estado, n in cerrados if estado == ESTADO_TERMINADO)
    cancelados = sum(n for _, estado, n in cerrados if estado == ESTADO_CANCELADO)

    serie_lotes = _serie(
        periodo,
        ("iniciados", "terminados", "cancelados"),
        [(d, "iniciados", n) for d, _, n in iniciados]
        + [
            (d, "terminados" if estado == ESTADO_TERMINADO else "cancelados", n)
            for d, estado, n in cerrados
        ],
    )

    # Cantidad elaborada por producto, toda pasada a kg para que se pueda
    # comparar entre productos (66 panes contra 44 kg de mermelada). Usa la
    # misma conversión que la tabla nutricional: el tipo y el factor de la
    # unidad, y para unidades o volumen el peso por unidad o la densidad que
    # el producto tiene cargados en su información nutricional. Lo que no se
    # puede pasar a kg no se mezcla en el ranking: va aparte, con su unidad.
    elaborado: list[schemas.Conteo] = []
    elaborado_sin_peso: list[schemas.Conteo] = []
    for pid, nombre, simbolo, tipo, factor, peso_g, densidad, total in db.execute(
        select(
            Producto.id,
            Producto.nombre,
            UnidadMedida.simbolo,
            UnidadMedida.tipo,
            UnidadMedida.factor_a_base,
            InfoNutricionalProducto.peso_unidad_g,
            InfoNutricionalProducto.densidad_g_ml,
            func.coalesce(func.sum(LoteProducto.cantidad_producida), 0),
        )
        .join(Producto, Producto.id == LoteProducto.producto_id)
        .join(UnidadMedida, UnidadMedida.id == Producto.unidad_medida_id)
        .outerjoin(InfoNutricionalProducto, InfoNutricionalProducto.producto_id == Producto.id)
        .where(
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.fecha_cierre.is_not(None),
            *_en_periodo(LoteProducto.fecha_cierre, periodo, True),
            *de_producto,
        )
        .group_by(
            Producto.id,
            Producto.nombre,
            UnidadMedida.simbolo,
            UnidadMedida.tipo,
            UnidadMedida.factor_a_base,
            InfoNutricionalProducto.peso_unidad_g,
            InfoNutricionalProducto.densidad_g_ml,
        )
    ).all():
        cantidad = Decimal(str(total or 0))
        original = f"{formatear_cantidad(cantidad)} {simbolo}"
        kilos = _a_kilos(cantidad, tipo, factor, peso_g, densidad)
        if kilos is None:
            elaborado_sin_peso.append(
                schemas.Conteo(clave=str(pid), etiqueta=nombre, valor=float(cantidad), detalle=original)
            )
            continue
        elaborado.append(
            schemas.Conteo(
                clave=str(pid),
                etiqueta=nombre,
                valor=round(float(kilos), 3),
                # Si el producto no se mide en kg, la cantidad en su unidad
                # acompaña ("66 un"); si ya es kg, no se repite.
                detalle=None if tipo == TIPO_MASA and simbolo.lower() == "kg" else original,
            )
        )
    elaborado.sort(key=lambda c: (-c.valor, c.etiqueta))
    elaborado = elaborado[:FILAS_RANKING]
    elaborado_sin_peso.sort(key=lambda c: c.etiqueta)

    # Lo mismo día por día, en la unidad de cada producto (kilos con kilos,
    # unidades con unidades) y con qué aportó cada uno: el mismo criterio de
    # "elaborado" (lote terminado, por día de cierre), así los totales del
    # gráfico diario y los del ranking coinciden.
    dia_cierre_terminado = func.date(LoteProducto.fecha_cierre)
    produccion_por_dia: dict[tuple[date, str], schemas.ProduccionDelDia] = {}
    for fecha, simbolo, nombre, total, lotes in db.execute(
        select(
            dia_cierre_terminado,
            UnidadMedida.simbolo,
            Producto.nombre,
            func.coalesce(func.sum(LoteProducto.cantidad_producida), 0),
            func.count(LoteProducto.id),
        )
        .join(Producto, Producto.id == LoteProducto.producto_id)
        .join(UnidadMedida, UnidadMedida.id == Producto.unidad_medida_id)
        .where(
            LoteProducto.estado == ESTADO_TERMINADO,
            LoteProducto.fecha_cierre.is_not(None),
            *_en_periodo(LoteProducto.fecha_cierre, periodo, True),
            *de_producto,
        )
        .group_by(dia_cierre_terminado, UnidadMedida.simbolo, Producto.nombre)
        .order_by(dia_cierre_terminado, UnidadMedida.simbolo)
    ).all():
        dia = _a_fecha(fecha)
        cantidad = round(float(total or 0), 3)
        del_dia = produccion_por_dia.setdefault(
            (dia, simbolo),
            schemas.ProduccionDelDia(fecha=dia, unidad=simbolo, cantidad=0, cantidad_lotes=0, productos=[]),
        )
        del_dia.cantidad = round(del_dia.cantidad + cantidad, 3)
        del_dia.cantidad_lotes += lotes
        del_dia.productos.append(
            schemas.ProductoDelDia(producto=nombre, cantidad=cantidad, cantidad_lotes=lotes)
        )
    for del_dia in produccion_por_dia.values():
        del_dia.productos.sort(key=lambda p: (-p.cantidad, p.producto))

    # Salidas registradas en el período, por día y por su estado actual.
    consulta_salidas = select(Salida.fecha_reserva, Salida.estado, func.count()).where(
        *_en_periodo(Salida.fecha_reserva, periodo, False)
    )
    consulta_retiros = select(Retiro.fecha_retiro, func.count()).where(
        *_en_periodo(Retiro.fecha_retiro, periodo, False)
    )
    en_curso = select(func.count()).select_from(Retiro).where(Retiro.estado == ESTADO_RETIRO_EN_CURSO)
    if producto_id is not None:
        consulta_salidas = consulta_salidas.join(LoteProducto, LoteProducto.id == Salida.lote_id).where(*de_producto)
        consulta_retiros = consulta_retiros.join(LoteProducto, LoteProducto.id == Retiro.lote_id).where(*de_producto)
        en_curso = en_curso.join(LoteProducto, LoteProducto.id == Retiro.lote_id).where(*de_producto)
    salidas = db.execute(consulta_salidas.group_by(Salida.fecha_reserva, Salida.estado)).all()
    retiros = db.execute(consulta_retiros.group_by(Retiro.fecha_retiro)).all()

    salidas_estado = {estado: 0 for estado in ESTADOS_SALIDA}
    for _, estado, cantidad in salidas:
        salidas_estado[estado] = salidas_estado.get(estado, 0) + cantidad

    # Lotes abiertos más antiguos, con el avance de su checklist.
    total_items = func.count(ChecklistProduccion.id)
    completos = func.coalesce(
        func.sum(case((ChecklistProduccion.completado_en.is_not(None), 1), else_=0)), 0
    )
    abiertos = db.execute(
        select(
            LoteProducto.id,
            LoteProducto.numero_lote,
            Producto.nombre,
            LoteProducto.fecha_inicio,
            total_items,
            completos,
        )
        .join(Producto, Producto.id == LoteProducto.producto_id)
        .outerjoin(ChecklistProduccion, ChecklistProduccion.lote_producto_id == LoteProducto.id)
        .where(LoteProducto.estado == ESTADO_EN_PROCESO, *de_producto)
        .group_by(LoteProducto.id, LoteProducto.numero_lote, Producto.nombre, LoteProducto.fecha_inicio)
        .order_by(LoteProducto.fecha_inicio)
        .limit(FILAS_LISTA)
    ).all()

    return schemas.PanelProduccion(
        periodo=periodo,
        productos=[
            schemas.Opcion(valor=str(pid), etiqueta=nombre)
            for pid, nombre in db.execute(
                select(Producto.id, Producto.nombre)
                .where(Producto.activo.is_(True))
                .order_by(Producto.nombre)
            ).all()
        ],
        lotes_en_proceso=en_proceso_total or 0,
        lotes_iniciados=sum(por_estado.values()),
        lotes_terminados=terminados,
        lotes_cancelados=cancelados,
        salidas_registradas=sum(salidas_estado.values()),
        salidas_rechazadas=salidas_estado.get(ESTADO_RECHAZADA, 0),
        retiros_en_curso=db.scalar(en_curso) or 0,
        retiros_periodo=sum(n for _, n in retiros),
        serie_lotes=serie_lotes,
        serie_lotes_por_estado=_serie(periodo, ESTADOS_LOTE, iniciados),
        lotes_por_estado=[
            schemas.Conteo(clave=estado, etiqueta=ETIQUETA_ESTADO_LOTE[estado], valor=por_estado[estado])
            for estado in ESTADOS_LOTE
        ],
        elaborado_por_producto=elaborado,
        elaborado_sin_peso=elaborado_sin_peso,
        produccion_por_dia=list(produccion_por_dia.values()),
        serie_salidas_retiros=_serie(
            periodo,
            ("salidas", "retiros"),
            [(d, "salidas", n) for d, _, n in salidas] + [(d, "retiros", n) for d, n in retiros],
        ),
        salidas_por_estado=[
            schemas.Conteo(clave=estado, etiqueta=ETIQUETA_ESTADO_SALIDA[estado], valor=salidas_estado[estado])
            for estado in ESTADOS_SALIDA
        ],
        en_proceso=[
            schemas.FilaAtencion(
                clave=f"lote-{lote_id}",
                titulo=f"{numero} · {producto}",
                detalle=f"Iniciado el {inicio:%d/%m/%Y}",
                tono="ok" if total and hechos == total else "info",
                estado=f"{hechos}/{total} tareas",
                link=f"/lotes/{lote_id}",
            )
            for lote_id, numero, producto, inicio, total, hechos in abiertos
        ],
        catalogo=_catalogo_produccion(db) if administra else None,
    )


# ───────────────────────────── Inventario ─────────────────────────────


def panel_inventario(
    db: Session, periodo: schemas.Periodo, tipo: Optional[str]
) -> schemas.PanelInventario:
    hoy_dia = hoy()
    de_tipo = () if tipo is None else (Insumo.tipo == tipo,)

    insumos = db.execute(
        select(Insumo.id, Insumo.tipo).where(Insumo.activo.is_(True), *de_tipo)
    ).all()
    ids_insumo = {insumo_id for insumo_id, _ in insumos}

    # El saldo de cada lote lo calcula el servicio de stock (recibido menos
    # consumos): acá solo se reparte, no se vuelve a definir qué es "stock".
    lotes = [
        lote
        for lote in lotes_insumo_services.stock_por_lote(db)
        if lote.insumo_id in ids_insumo
    ]
    stock: dict[int, Decimal] = defaultdict(Decimal)
    stock_vencido: set[int] = set()
    tramos_vencimiento = {"vencido": 0, "semana": 0, "mes": 0, "despues": 0, "sin_fecha": 0}
    con_saldo = []
    for lote in lotes:
        stock[lote.insumo_id] += lote.saldo
        if lote.saldo <= 0:
            continue
        con_saldo.append(lote)
        if lote.fecha_vencimiento is None:
            tramos_vencimiento["sin_fecha"] += 1
            continue
        dias = (lote.fecha_vencimiento - hoy_dia).days
        if dias < 0:
            tramos_vencimiento["vencido"] += 1
            stock_vencido.add(lote.insumo_id)
        elif dias <= DIAS_POR_VENCER:
            tramos_vencimiento["semana"] += 1
        elif dias <= 30:
            tramos_vencimiento["mes"] += 1
        else:
            tramos_vencimiento["despues"] += 1

    sin_stock = {insumo_id for insumo_id in ids_insumo if stock[insumo_id] <= 0}

    # Movimientos del período, en cantidad de registros: cada insumo tiene su
    # unidad (kg, l, un) y sumar cantidades entre insumos no significa nada.
    dia_consumo = func.date(ConsumoInsumo.registrado_en)
    consumos = db.execute(
        select(dia_consumo, ConsumoInsumo.tipo, func.count())
        .join(LoteInsumo, LoteInsumo.id == ConsumoInsumo.lote_insumo_id)
        .join(Insumo, Insumo.id == LoteInsumo.insumo_id)
        .where(*_en_periodo(ConsumoInsumo.registrado_en, periodo, True), *de_tipo)
        .group_by(dia_consumo, ConsumoInsumo.tipo)
    ).all()
    recibidos = db.execute(
        select(LoteInsumo.fecha_ingreso, func.count())
        .join(Insumo, Insumo.id == LoteInsumo.insumo_id)
        .where(*_en_periodo(LoteInsumo.fecha_ingreso, periodo, False), *de_tipo)
        .group_by(LoteInsumo.fecha_ingreso)
    ).all()
    clave_consumo = {TIPO_CONSUMO_REAL: "consumos", TIPO_CONSUMO_DESPERDICIO: "desperdicios"}

    mas_movimiento = [
        schemas.Conteo(
            clave=str(insumo_id),
            etiqueta=nombre,
            valor=cantidad,
            detalle=f"{_plural(cantidad, 'consumo', 'consumos')} · {formatear_cantidad(Decimal(str(total or 0)))} {unidad}",
        )
        for insumo_id, nombre, unidad, cantidad, total in db.execute(
            select(
                Insumo.id,
                Insumo.nombre,
                UnidadMedida.simbolo,
                func.count(ConsumoInsumo.id),
                func.sum(ConsumoInsumo.cantidad),
            )
            .join(LoteInsumo, LoteInsumo.id == ConsumoInsumo.lote_insumo_id)
            .join(Insumo, Insumo.id == LoteInsumo.insumo_id)
            .join(UnidadMedida, UnidadMedida.id == Insumo.unidad_medida_id)
            .where(*_en_periodo(ConsumoInsumo.registrado_en, periodo, True), *de_tipo)
            .group_by(Insumo.id, Insumo.nombre, UnidadMedida.simbolo)
            .order_by(func.count(ConsumoInsumo.id).desc(), Insumo.nombre)
            .limit(FILAS_RANKING)
        ).all()
    ]

    por_proveedor = [
        schemas.Conteo(clave=str(proveedor_id), etiqueta=nombre, valor=cantidad)
        for proveedor_id, nombre, cantidad in db.execute(
            select(Proveedor.id, Proveedor.nombre, func.count(LoteInsumo.id))
            .join(LoteInsumo, LoteInsumo.proveedor_id == Proveedor.id)
            .join(Insumo, Insumo.id == LoteInsumo.insumo_id)
            .where(*_en_periodo(LoteInsumo.fecha_ingreso, periodo, False), *de_tipo)
            .group_by(Proveedor.id, Proveedor.nombre)
            .order_by(func.count(LoteInsumo.id).desc(), Proveedor.nombre)
            .limit(FILAS_RANKING)
        ).all()
    ]

    # Un proveedor tiene la certificación vencida si, para algún tipo, la más
    # nueva que cargó ya venció (una renovada tapa a la anterior).
    ultima = (
        select(
            CertificacionProveedor.proveedor_id.label("proveedor_id"),
            func.max(CertificacionProveedor.fecha_vencimiento).label("vence"),
        )
        .join(Proveedor, Proveedor.id == CertificacionProveedor.proveedor_id)
        .where(Proveedor.activo.is_(True))
        .group_by(CertificacionProveedor.proveedor_id, CertificacionProveedor.tipo)
        .subquery()
    )
    certificacion_vencida = db.scalar(
        select(func.count(func.distinct(ultima.c.proveedor_id))).where(ultima.c.vence < hoy_dia)
    )

    conteo_tipo: dict[str, int] = defaultdict(int)
    for _, tipo_insumo in insumos:
        conteo_tipo[tipo_insumo] += 1

    # Con fecha, primero lo que vence antes (FEFO): es lo que hay que usar.
    proximos = sorted(
        (lote for lote in con_saldo if lote.fecha_vencimiento is not None),
        key=lambda lote: lote.fecha_vencimiento,
    )[:FILAS_LISTA]
    vencen_primero = []
    for lote in proximos:
        tono, estado = _plazo((lote.fecha_vencimiento - hoy_dia).days)
        vencen_primero.append(
            schemas.FilaAtencion(
                clave=f"lote-insumo-{lote.lote_insumo_id}",
                titulo=f"{lote.insumo_nombre} · lote {lote.numero_lote}",
                detalle=f"{lote.proveedor_nombre} · vence el {lote.fecha_vencimiento:%d/%m/%Y}",
                tono=tono,
                estado=estado,
                link="/stock-insumos",
            )
        )

    con_stock_ok = len(ids_insumo) - len(sin_stock) - len(stock_vencido - sin_stock)
    return schemas.PanelInventario(
        periodo=periodo,
        insumos_activos=len(ids_insumo),
        insumos_sin_stock=len(sin_stock),
        lotes_vencidos=tramos_vencimiento["vencido"],
        lotes_por_vencer=tramos_vencimiento["semana"],
        lotes_recibidos=sum(n for _, n in recibidos),
        proveedores_activos=db.scalar(
            select(func.count()).select_from(Proveedor).where(Proveedor.activo.is_(True))
        )
        or 0,
        proveedores_certificacion_vencida=certificacion_vencida or 0,
        serie_movimientos=_serie(
            periodo,
            ("ingresos", "consumos", "desperdicios"),
            [(d, "ingresos", n) for d, n in recibidos]
            + [(d, clave_consumo[t], n) for d, t, n in consumos if t in clave_consumo],
        ),
        lotes_por_vencimiento=[
            schemas.Conteo(clave="vencido", etiqueta="Vencidos", valor=tramos_vencimiento["vencido"]),
            schemas.Conteo(
                clave="semana",
                etiqueta=f"Vencen en {DIAS_POR_VENCER} días o menos",
                valor=tramos_vencimiento["semana"],
            ),
            schemas.Conteo(clave="mes", etiqueta="Vencen en 8 a 30 días", valor=tramos_vencimiento["mes"]),
            schemas.Conteo(clave="despues", etiqueta="Vencen en más de 30 días", valor=tramos_vencimiento["despues"]),
            schemas.Conteo(clave="sin_fecha", etiqueta="Sin fecha de vencimiento", valor=tramos_vencimiento["sin_fecha"]),
        ],
        insumos_por_tipo=[
            schemas.Conteo(clave=clave, etiqueta=ETIQUETA_TIPO_INSUMO.get(clave, clave), valor=cantidad)
            for clave, cantidad in sorted(conteo_tipo.items())
        ],
        estado_stock=[
            schemas.Conteo(clave="con_stock", etiqueta="Con stock vigente", valor=con_stock_ok),
            schemas.Conteo(
                clave="con_vencido",
                etiqueta="Con stock vencido",
                valor=len(stock_vencido - sin_stock),
            ),
            schemas.Conteo(clave="sin_stock", etiqueta="Sin stock", valor=len(sin_stock)),
        ],
        mas_movimiento=mas_movimiento,
        recepciones_por_proveedor=por_proveedor,
        vencen_primero=vencen_primero,
    )


# ────────────────────────────── Limpieza ──────────────────────────────


def _atencion_limpieza(db: Session, hoy_dia: date) -> tuple[int, int, list[schemas.FilaAtencion]]:
    bajos = db.execute(
        select(
            InsumoQuimico.id,
            InsumoQuimico.nombre,
            StockInsumoQuimico.cantidad_actual,
            StockInsumoQuimico.stock_minimo,
            UnidadMedida.simbolo,
        )
        .join(StockInsumoQuimico, StockInsumoQuimico.insumo_quimico_id == InsumoQuimico.id)
        .join(UnidadMedida, UnidadMedida.id == InsumoQuimico.unidad_medida_id)
        .where(
            InsumoQuimico.activo.is_(True),
            StockInsumoQuimico.stock_minimo.is_not(None),
            StockInsumoQuimico.cantidad_actual < StockInsumoQuimico.stock_minimo,
        )
        .order_by(InsumoQuimico.nombre)
    ).all()
    filas = [
        schemas.FilaAtencion(
            clave=f"quimico-{insumo_id}",
            titulo=nombre,
            detalle=f"Quedan {formatear_cantidad(actual)} {unidad} · mínimo {formatear_cantidad(minimo)} {unidad}",
            tono="peligro" if actual <= 0 else "alerta",
            estado="Sin stock" if actual <= 0 else "Stock bajo",
            link="/gestion-stock",
        )
        for insumo_id, nombre, actual, minimo, unidad in bajos
    ]

    vencidos = 0
    elementos = db.execute(
        select(
            ElementoLimpieza.id,
            ElementoLimpieza.nombre,
            ElementoLimpieza.fecha_ultimo_recambio,
            ElementoLimpieza.frecuencia_recambio_dias,
        ).where(
            ElementoLimpieza.activo.is_(True),
            ElementoLimpieza.fecha_ultimo_recambio.is_not(None),
            ElementoLimpieza.frecuencia_recambio_dias.is_not(None),
        )
    ).all()
    for elemento_id, nombre, ultimo, frecuencia in elementos:
        dias = (ultimo + timedelta(days=frecuencia) - hoy_dia).days
        if dias < 0:
            vencidos += 1
            filas.append(
                schemas.FilaAtencion(
                    clave=f"elemento-{elemento_id}",
                    titulo=nombre,
                    detalle=f"Último recambio el {ultimo:%d/%m/%Y}",
                    tono="peligro",
                    estado=f"Recambio vencido hace {_plural(-dias, 'día', 'días')}",
                    link="/elementos-limpieza",
                )
            )
    return len(bajos), vencidos, filas[: FILAS_LISTA + 2]


def panel_limpieza(
    db: Session,
    periodo: schemas.Periodo,
    sector_id: Optional[int],
    usuario: Personal,
    administra: bool,
) -> schemas.PanelLimpieza:
    hoy_dia = hoy()
    # Quien solo opera ve el cumplimiento de las tareas que tiene asignadas.
    alcance = []
    if sector_id is not None:
        alcance.append(Equipo.sector_id == sector_id)
    if not administra:
        alcance.append(RegistroTarea.operador_id == usuario.id)

    base = (
        select(
            Checklist.fecha,
            Checklist.equipo_id,
            RegistroTarea.tipo_tarea_historico,
            func.count(RegistroTarea.id),
            func.coalesce(func.sum(case((RegistroTarea.completado.is_(True), 1), else_=0)), 0),
        )
        .join(Checklist, Checklist.id == RegistroTarea.checklist_id)
        .join(Equipo, Equipo.id == Checklist.equipo_id)
        .where(
            Checklist.fecha >= periodo.desde,
            # Lo programado a futuro todavía no se puede haber cumplido.
            Checklist.fecha <= min(periodo.hasta, hoy_dia),
            *alcance,
        )
        .group_by(Checklist.fecha, Checklist.equipo_id, RegistroTarea.tipo_tarea_historico)
    )
    filas = db.execute(base).all()

    total = sum(n for *_, n, _ in filas)
    completadas = sum(int(c) for *_, c in filas)
    incumplidas = sum(n - int(c) for fecha, _, _, n, c in filas if fecha < hoy_dia)

    pendientes_hoy = db.scalar(
        select(func.count(RegistroTarea.id))
        .join(Checklist, Checklist.id == RegistroTarea.checklist_id)
        .join(Equipo, Equipo.id == Checklist.equipo_id)
        .where(Checklist.fecha == hoy_dia, RegistroTarea.completado.is_(False), *alcance)
    )

    # Serie de % de cumplimiento: se acumulan totales y completadas por tramo.
    granularidad = _granularidad(periodo)
    por_tramo: dict[date, list[int]] = {t: [0, 0] for t in _tramos(periodo, granularidad)}
    por_equipo: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    por_momento: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for fecha, equipo_id, momento, n, c in filas:
        tramo = _inicio_tramo(fecha, granularidad)
        for acumulado in (por_tramo.get(tramo), por_equipo[equipo_id], por_momento[momento or ""]):
            if acumulado is not None:
                acumulado[0] += n
                acumulado[1] += int(c)

    equipos = {
        equipo_id: (nombre, sector)
        for equipo_id, nombre, sector in db.execute(
            select(Equipo.id, Equipo.nombre, Sector.nombre)
            .join(Sector, Sector.id == Equipo.sector_id)
            .where(Equipo.id.in_(por_equipo.keys()))
        ).all()
    } if por_equipo else {}

    por_sector: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for equipo_id, (n, c) in por_equipo.items():
        sector = equipos.get(equipo_id, ("", "Sin sector"))[1]
        por_sector[sector][0] += n
        por_sector[sector][1] += c

    # Mismo cruce, abierto por tramo: dónde y cuándo se cumple menos.
    sector_tramo: dict[tuple[str, date], list[int]] = defaultdict(lambda: [0, 0])
    for fecha, equipo_id, _, n, c in filas:
        sector = equipos.get(equipo_id, ("", "Sin sector"))[1]
        celda = sector_tramo[(sector, _inicio_tramo(fecha, granularidad))]
        celda[0] += n
        celda[1] += int(c)

    def _conteo_cumplimiento(clave: str, etiqueta: str, n: int, c: int) -> schemas.Conteo:
        return schemas.Conteo(
            clave=clave,
            etiqueta=etiqueta,
            valor=_porcentaje(c, n) or 0.0,
            detalle=f"{c} de {_plural(n, 'tarea', 'tareas')}",
        )

    # Checklists del período con el estado con que se muestran: uno de un día
    # pasado que quedó abierto o completo se lee como cerrado (mismo criterio
    # que el historial de checklists).
    consulta_checklists = (
        select(Checklist.estado, Checklist.fecha < hoy_dia, func.count(func.distinct(Checklist.id)))
        .join(Equipo, Equipo.id == Checklist.equipo_id)
        .where(Checklist.fecha >= periodo.desde, Checklist.fecha <= min(periodo.hasta, hoy_dia))
        .group_by(Checklist.estado, Checklist.fecha < hoy_dia)
    )
    if sector_id is not None:
        consulta_checklists = consulta_checklists.where(Equipo.sector_id == sector_id)
    if not administra:
        consulta_checklists = consulta_checklists.join(
            RegistroTarea, RegistroTarea.checklist_id == Checklist.id
        ).where(RegistroTarea.operador_id == usuario.id)
    estados = {estado: 0 for estado in EstadoChecklist}
    for estado, pasado, cantidad in db.execute(consulta_checklists).all():
        estado = EstadoChecklist(estado)
        if pasado and estado in (EstadoChecklist.ABIERTO, EstadoChecklist.COMPLETO):
            estado = EstadoChecklist.CERRADO
        estados[estado] += cantidad

    planes = select(func.count(func.distinct(PlanLimpieza.id))).join(
        Equipo, Equipo.id == PlanLimpieza.equipo_id
    ).where(PlanLimpieza.activo.is_(True), Equipo.activo.is_(True))
    tareas = (
        select(func.count(Tarea.id))
        .join(PlanLimpieza, PlanLimpieza.id == Tarea.plan_limpieza_id)
        .join(Equipo, Equipo.id == PlanLimpieza.equipo_id)
        .where(Tarea.activo.is_(True), PlanLimpieza.activo.is_(True), Equipo.activo.is_(True))
    )
    if sector_id is not None:
        planes = planes.where(Equipo.sector_id == sector_id)
        tareas = tareas.where(Equipo.sector_id == sector_id)
    if not administra:
        planes = planes.join(Tarea, Tarea.plan_limpieza_id == PlanLimpieza.id).where(
            Tarea.activo.is_(True), Tarea.operador_id == usuario.id
        )
        tareas = tareas.where(Tarea.operador_id == usuario.id)

    bajo_minimo = recambio_vencido = atencion = None
    if administra:
        bajo_minimo, recambio_vencido, atencion = _atencion_limpieza(db, hoy_dia)

    menor_cumplimiento = sorted(
        (
            _conteo_cumplimiento(str(equipo_id), equipos.get(equipo_id, (f"Equipo {equipo_id}", ""))[0], n, c)
            for equipo_id, (n, c) in por_equipo.items()
        ),
        key=lambda conteo: (conteo.valor, conteo.etiqueta),
    )[:FILAS_RANKING]

    return schemas.PanelLimpieza(
        periodo=periodo,
        sectores=_sectores(db),
        solo_propias=not administra,
        tareas_total=total,
        tareas_completadas=completadas,
        cumplimiento=_porcentaje(completadas, total),
        pendientes_hoy=pendientes_hoy or 0,
        tareas_incumplidas=incumplidas,
        planes_activos=db.scalar(planes) or 0,
        tareas_activas=db.scalar(tareas) or 0,
        checklists_observados=estados[EstadoChecklist.OBSERVADO],
        serie_cumplimiento=schemas.Serie(
            granularidad=granularidad,
            puntos=[
                schemas.PuntoSerie(
                    clave=tramo,
                    etiqueta=_etiqueta_tramo(tramo, granularidad),
                    valores={
                        "cumplimiento": _porcentaje(c, n),
                        "completadas": float(c),
                        "programadas": float(n),
                    },
                )
                for tramo, (n, c) in por_tramo.items()
            ],
        ),
        mapa_cumplimiento=_mapa(
            periodo,
            [(sector, sector) for sector in sorted(por_sector)],
            {clave: _porcentaje(c, n) for clave, (n, c) in sector_tramo.items()},
            # Sin tareas programadas no hay porcentaje: la celda queda vacía.
            None,
        ),
        checklists_por_estado=[
            schemas.Conteo(clave=estado.value, etiqueta=ETIQUETA_ESTADO_CHECKLIST[estado.value], valor=estados[estado])
            for estado in EstadoChecklist
        ],
        cumplimiento_por_sector=sorted(
            (_conteo_cumplimiento(sector, sector, n, c) for sector, (n, c) in por_sector.items()),
            key=lambda conteo: conteo.etiqueta,
        ),
        equipos_menor_cumplimiento=menor_cumplimiento,
        cumplimiento_por_momento=[
            _conteo_cumplimiento(clave, etiqueta, *por_momento[clave])
            for clave, etiqueta in ETIQUETA_MOMENTO_TAREA.items()
            if por_momento[clave][0] > 0
        ],
        quimicos_bajo_minimo=bajo_minimo,
        elementos_recambio_vencido=recambio_vencido,
        atencion=atencion,
    )


# ─────────────────────────────── Equipos ──────────────────────────────


def panel_equipos(
    db: Session, periodo: schemas.Periodo, sector_id: Optional[int]
) -> schemas.PanelEquipos:
    hoy_dia = hoy()
    de_sector = () if sector_id is None else (Equipo.sector_id == sector_id,)

    activos = inactivos = 0
    for activo, cantidad in db.execute(
        select(Equipo.activo, func.count()).where(*de_sector).group_by(Equipo.activo)
    ).all():
        if activo:
            activos = cantidad
        else:
            inactivos = cantidad

    por_sector = db.execute(
        select(Sector.id, Sector.nombre, func.count(Equipo.id))
        .join(Equipo, Equipo.sector_id == Sector.id)
        .where(Equipo.activo.is_(True), *de_sector)
        .group_by(Sector.id, Sector.nombre)
        .order_by(func.count(Equipo.id).desc(), Sector.nombre)
    ).all()
    por_tipo = db.execute(
        select(Equipo.tipo, func.count(Equipo.id))
        .where(Equipo.activo.is_(True), *de_sector)
        .group_by(Equipo.tipo)
        .order_by(func.count(Equipo.id).desc(), Equipo.tipo)
        .limit(FILAS_RANKING)
    ).all()

    # Incidentes asociados a un equipo.
    con_equipo = (Incidente.equipo_id.is_not(None), *de_sector)
    abiertos, equipos_abiertos = db.execute(
        select(func.count(Incidente.id), func.count(func.distinct(Incidente.equipo_id)))
        .join(Equipo, Equipo.id == Incidente.equipo_id)
        .where(Incidente.estado == EstadoIncidente.ABIERTO.value, *con_equipo)
    ).one()

    dia_reporte = func.date(Incidente.fecha_reporte)
    dia_cierre = func.date(Incidente.fecha_cierre)
    reportados = db.execute(
        select(dia_reporte, func.count())
        .join(Equipo, Equipo.id == Incidente.equipo_id)
        .where(*_en_periodo(Incidente.fecha_reporte, periodo, True), *con_equipo)
        .group_by(dia_reporte)
    ).all()
    cerrados = db.execute(
        select(dia_cierre, func.count())
        .join(Equipo, Equipo.id == Incidente.equipo_id)
        .where(
            Incidente.fecha_cierre.is_not(None),
            *_en_periodo(Incidente.fecha_cierre, periodo, True),
            *con_equipo,
        )
        .group_by(dia_cierre)
    ).all()

    abiertos_por_equipo = func.coalesce(
        func.sum(case((Incidente.estado == EstadoIncidente.ABIERTO.value, 1), else_=0)), 0
    )
    mas_incidentes = [
        schemas.Conteo(
            clave=str(equipo_id),
            etiqueta=nombre,
            valor=cantidad,
            detalle=(
                f"{_plural(cantidad, 'incidente', 'incidentes')} · {_plural(int(sin_cerrar), 'abierto', 'abiertos')}"
                if sin_cerrar
                else _plural(cantidad, "incidente", "incidentes")
            ),
        )
        for equipo_id, nombre, cantidad, sin_cerrar in db.execute(
            select(Equipo.id, Equipo.nombre, func.count(Incidente.id), abiertos_por_equipo)
            .join(Incidente, Incidente.equipo_id == Equipo.id)
            .where(*_en_periodo(Incidente.fecha_reporte, periodo, True), *de_sector)
            .group_by(Equipo.id, Equipo.nombre)
            .order_by(func.count(Incidente.id).desc(), Equipo.nombre)
            .limit(FILAS_RANKING)
        ).all()
    ]

    # Planes de calibración y mantenimiento: mismo criterio de estado que la
    # pantalla de Vencimientos, para que los números coincidan.
    planes = db.scalars(
        select(PlanCalibracionMantenimiento)
        .join(Equipo, Equipo.id == PlanCalibracionMantenimiento.equipo_id)
        .options(selectinload(PlanCalibracionMantenimiento.equipo))
        .where(PlanCalibracionMantenimiento.activo.is_(True), Equipo.activo.is_(True), *de_sector)
    ).all()
    estado_planes = {
        "calibracion": schemas.EstadoPlanes(clave="calibracion", etiqueta="Calibración", al_dia=0, proximos=0, vencidos=0),
        "mantenimiento": schemas.EstadoPlanes(clave="mantenimiento", etiqueta="Mantenimiento", al_dia=0, proximos=0, vencidos=0),
    }
    equipos_con_plan = set()
    for plan in planes:
        equipos_con_plan.add(plan.equipo_id)
        grupo = estado_planes.get(plan.tipo)
        if grupo is None:
            continue
        estado = estado_documento(plan.proxima_fecha_vencimiento, hoy_dia, MARGEN_DIAS_ALERTA)
        if estado == VENCIDO:
            grupo.vencidos += 1
        elif estado == PROXIMO:
            grupo.proximos += 1
        else:
            grupo.al_dia += 1

    proximas = []
    for plan in sorted(planes, key=lambda p: p.proxima_fecha_vencimiento)[:FILAS_LISTA]:
        tono, estado = _plazo((plan.proxima_fecha_vencimiento - hoy_dia).days)
        proximas.append(
            schemas.FilaAtencion(
                clave=f"plan-{plan.id}",
                titulo=plan.equipo.nombre,
                detalle=(
                    f"{'Calibración' if plan.tipo == 'calibracion' else 'Mantenimiento'}"
                    f" · {plan.proxima_fecha_vencimiento:%d/%m/%Y}"
                ),
                tono=tono,
                estado=estado,
                link=f"/equipos/detalle/{plan.equipo_id}",
            )
        )

    intervenciones = db.scalar(
        select(func.count(Calibracion.id))
        .join(Equipo, Equipo.id == Calibracion.equipo_id)
        .where(
            Calibracion.activo.is_(True),
            *_en_periodo(Calibracion.fecha_realizacion, periodo, False),
            *de_sector,
        )
    )
    ids_activos = set(
        db.scalars(select(Equipo.id).where(Equipo.activo.is_(True), *de_sector)).all()
    )

    return schemas.PanelEquipos(
        periodo=periodo,
        sectores=_sectores(db),
        equipos_activos=activos,
        equipos_inactivos=inactivos,
        equipos_con_incidentes_abiertos=equipos_abiertos or 0,
        incidentes_abiertos=abiertos or 0,
        incidentes_periodo=sum(n for _, n in reportados),
        planes_vencidos=sum(g.vencidos for g in estado_planes.values()),
        planes_proximos=sum(g.proximos for g in estado_planes.values()),
        equipos_sin_plan=len(ids_activos - equipos_con_plan),
        intervenciones_periodo=intervenciones or 0,
        serie_incidentes=_serie(
            periodo,
            ("reportados", "cerrados"),
            [(d, "reportados", n) for d, n in reportados] + [(d, "cerrados", n) for d, n in cerrados],
        ),
        estado_planes=list(estado_planes.values()),
        equipos_por_sector=[
            schemas.Conteo(clave=str(sid), etiqueta=nombre, valor=cantidad)
            for sid, nombre, cantidad in por_sector
        ],
        equipos_por_tipo=[
            schemas.Conteo(clave=tipo, etiqueta=tipo, valor=cantidad) for tipo, cantidad in por_tipo
        ],
        equipos_mas_incidentes=mas_incidentes,
        proximas_intervenciones=proximas,
    )


# ─────────────────────────────── Calidad ──────────────────────────────


def panel_calidad(
    db: Session,
    periodo: schemas.Periodo,
    tipo: Optional[str],
    usuario: Personal,
    administra: bool,
) -> schemas.PanelCalidad:
    ahora_dt = datetime.combine(hoy(), time.min) + timedelta(days=1)
    alcance = []
    if tipo is not None:
        alcance.append(Incidente.tipo == tipo)
    if not administra:
        # Quien opera solo puede ver los incidentes que reportó.
        alcance.append(Incidente.usuario_id == usuario.id)

    abiertos = db.execute(
        select(Incidente.id, Incidente.titulo, Incidente.fecha_reporte, Personal.nombre, Personal.apellido)
        .join(Personal, Personal.id == Incidente.usuario_id)
        .where(Incidente.estado == EstadoIncidente.ABIERTO.value, *alcance)
        .order_by(Incidente.fecha_reporte)
    ).all()

    antiguedad = {"semana": 0, "mes": 0, "mas": 0}
    filas_abiertos = []
    for incidente_id, titulo, fecha, nombre, apellido in abiertos:
        dias = max(0, (ahora_dt - fecha).days)
        antiguedad["semana" if dias <= 7 else "mes" if dias <= 30 else "mas"] += 1
        if len(filas_abiertos) < FILAS_LISTA:
            filas_abiertos.append(
                schemas.FilaAtencion(
                    clave=f"incidente-{incidente_id}",
                    titulo=titulo,
                    detalle=f"#{incidente_id} · reportado el {fecha:%d/%m/%Y} por {_nombre_persona(nombre, apellido)}",
                    tono="peligro" if dias > 7 else "alerta",
                    estado="Abierto hoy" if dias == 0 else f"Abierto hace {_plural(dias, 'día', 'días')}",
                    link=f"/incidentes/{incidente_id}" if administra else "/incidentes/reportar",
                )
            )

    dia_reporte = func.date(Incidente.fecha_reporte)
    reportados = db.execute(
        select(dia_reporte, Incidente.tipo, Incidente.estado, func.count())
        .where(*_en_periodo(Incidente.fecha_reporte, periodo, True), *alcance)
        .group_by(dia_reporte, Incidente.tipo, Incidente.estado)
    ).all()
    total_reportados = sum(n for *_, n in reportados)
    resueltos = sum(n for _, _, estado, n in reportados if estado == EstadoIncidente.CERRADO.value)
    por_tipo: dict[str, int] = defaultdict(int)
    granularidad = _granularidad(periodo)
    tipo_tramo: dict[tuple[str, date], float] = defaultdict(float)
    for dia, tipo_incidente, _, n in reportados:
        por_tipo[tipo_incidente] += n
        tipo_tramo[(tipo_incidente, _inicio_tramo(_a_fecha(dia), granularidad))] += n

    # Cerrados en el período: de acá salen la serie y el tiempo de resolución.
    cierres = db.execute(
        select(Incidente.fecha_reporte, Incidente.fecha_cierre).where(
            Incidente.fecha_cierre.is_not(None),
            *_en_periodo(Incidente.fecha_cierre, periodo, True),
            *alcance,
        )
    ).all()
    dias_resolucion = (
        round(
            sum((cierre - reporte).total_seconds() for reporte, cierre in cierres) / len(cierres) / 86400,
            1,
        )
        if cierres
        else None
    )

    reclamos = db.execute(
        select(Reclamo.motivo, Reclamo.fuera_de_plazo, func.count())
        .where(*_en_periodo(Reclamo.fecha_reclamo, periodo, False))
        .group_by(Reclamo.motivo, Reclamo.fuera_de_plazo)
    ).all()
    por_motivo: dict[str, int] = defaultdict(int)
    for motivo, _, n in reclamos:
        por_motivo[motivo] += n
    productos_reclamados = [
        schemas.Conteo(clave=str(pid), etiqueta=nombre, valor=cantidad)
        for pid, nombre, cantidad in db.execute(
            select(Producto.id, Producto.nombre, func.count(Reclamo.id))
            .join(LoteProducto, LoteProducto.producto_id == Producto.id)
            .join(Reclamo, Reclamo.lote_id == LoteProducto.id)
            .where(*_en_periodo(Reclamo.fecha_reclamo, periodo, False))
            .group_by(Producto.id, Producto.nombre)
            .order_by(func.count(Reclamo.id).desc(), Producto.nombre)
            .limit(FILAS_RANKING)
        ).all()
    ]

    vencidos = proximos = por_tipo_vencimiento = None
    if administra:
        vencimientos = [
            v for v in vencimientos_services.listar_vencimientos(db) if v.estado in (VENCIDO, PROXIMO)
        ]
        vencidos = sum(1 for v in vencimientos if v.estado == VENCIDO)
        proximos = len(vencimientos) - vencidos
        por_tipo_vencimiento = []
        for clave, etiqueta in ETIQUETA_TIPO_VENCIMIENTO.items():
            del_tipo = [v for v in vencimientos if v.tipo == clave]
            n_vencidos = sum(1 for v in del_tipo if v.estado == VENCIDO)
            por_tipo_vencimiento.append(
                schemas.Conteo(
                    clave=clave,
                    etiqueta=etiqueta,
                    valor=len(del_tipo),
                    detalle=f"{_plural(n_vencidos, 'vencido', 'vencidos')} · {len(del_tipo) - n_vencidos} por vencer",
                )
            )

    return schemas.PanelCalidad(
        periodo=periodo,
        tipos=[
            schemas.Opcion(valor=t.value, etiqueta=ETIQUETA_TIPO_INCIDENTE[t.value]) for t in TipoIncidente
        ],
        solo_propios=not administra,
        incidentes_abiertos=len(abiertos),
        incidentes_reportados=total_reportados,
        incidentes_resueltos=resueltos,
        porcentaje_resuelto=_porcentaje(resueltos, total_reportados),
        dias_resolucion=dias_resolucion,
        cerrados_periodo=len(cierres),
        reclamos=sum(n for *_, n in reclamos),
        reclamos_fuera_de_plazo=sum(n for _, fuera, n in reclamos if fuera),
        retiros_en_curso=db.scalar(
            select(func.count()).select_from(Retiro).where(Retiro.estado == ESTADO_RETIRO_EN_CURSO)
        )
        or 0,
        serie_incidentes=_serie(
            periodo,
            ("reportados", "cerrados"),
            [(d, "reportados", n) for d, _, _, n in reportados]
            + [(cierre.date(), "cerrados", 1) for _, cierre in cierres],
        ),
        incidentes_por_tipo=[
            schemas.Conteo(clave=t.value, etiqueta=ETIQUETA_TIPO_INCIDENTE[t.value], valor=por_tipo[t.value])
            for t in TipoIncidente
            if por_tipo[t.value] > 0
        ],
        mapa_incidentes=_mapa(
            periodo,
            [(t.value, ETIQUETA_TIPO_INCIDENTE[t.value]) for t in TipoIncidente if por_tipo[t.value] > 0],
            dict(tipo_tramo),
            # Un tramo sin incidentes de ese tipo es un cero real.
            0.0,
        ),
        antiguedad_abiertos=[
            schemas.Conteo(clave="semana", etiqueta="Hasta 7 días", valor=antiguedad["semana"]),
            schemas.Conteo(clave="mes", etiqueta="De 8 a 30 días", valor=antiguedad["mes"]),
            schemas.Conteo(clave="mas", etiqueta="Más de 30 días", valor=antiguedad["mas"]),
        ],
        motivos_reclamo=[
            schemas.Conteo(clave=motivo, etiqueta=ETIQUETAS_MOTIVO_RECLAMO[motivo], valor=por_motivo[motivo])
            for motivo in MOTIVOS_RECLAMO
            if por_motivo[motivo] > 0
        ],
        productos_con_reclamos=productos_reclamados,
        abiertos_antiguos=filas_abiertos,
        vencimientos_vencidos=vencidos,
        vencimientos_proximos=proximos,
        vencimientos_por_tipo=por_tipo_vencimiento,
    )


# ────────────────────────────── Personas ──────────────────────────────


def _rol(es_super_admin: bool, puede_administrar: bool, puede_operar: bool) -> tuple[str, str]:
    """Rol excluyente, con el mismo criterio que el listado de personal."""
    if es_super_admin:
        return "super_admin", "Super administradores"
    if puede_administrar:
        return "admin", "Administradores"
    if puede_operar:
        return "operador", "Operadores"
    return "sin_permisos", "Sin permisos"


def _activos_inactivos(db: Session, modelo) -> tuple[int, int]:
    activos = inactivos = 0
    for activo, cantidad in db.execute(select(modelo.activo, func.count()).group_by(modelo.activo)).all():
        if activo:
            activos = cantidad
        else:
            inactivos = cantidad
    return activos, inactivos


def panel_personas(db: Session, periodo: schemas.Periodo) -> schemas.PanelPersonas:
    hoy_dia = hoy()
    personal_activo, personal_inactivo = _activos_inactivos(db, Personal)
    clientes_activos, clientes_inactivos = _activos_inactivos(db, Cliente)
    transportistas_activos, transportistas_inactivos = _activos_inactivos(db, Transportista)

    roles: dict[tuple[str, str], int] = defaultdict(int)
    for es_super, administra, opera, cantidad in db.execute(
        select(Personal.es_super_admin, Personal.puede_administrar, Personal.puede_operar, func.count())
        .where(Personal.activo.is_(True))
        .group_by(Personal.es_super_admin, Personal.puede_administrar, Personal.puede_operar)
    ).all():
        roles[_rol(es_super, administra, opera)] += cantidad

    vencimientos = [
        v
        for v in vencimientos_services.listar_vencimientos(db, "PERSONAL")
        if v.estado in (VENCIDO, PROXIMO)
    ]
    aptitudes_atencion = []
    for v in vencimientos[:FILAS_LISTA]:
        tono, estado = _plazo(v.dias_restantes)
        aptitudes_atencion.append(
            schemas.FilaAtencion(
                clave=v.id_vencimiento,
                titulo=v.sujeto,
                detalle=f"{v.detalle} · {v.fecha_vencimiento:%d/%m/%Y}",
                tono=tono,
                estado=estado,
                link=v.link_destino,
            )
        )

    # Tareas de limpieza asignadas a cada operador en el período.
    completadas = func.coalesce(func.sum(case((RegistroTarea.completado.is_(True), 1), else_=0)), 0)
    asignadas = db.execute(
        select(Personal.id, Personal.nombre, Personal.apellido, func.count(RegistroTarea.id), completadas)
        .join(RegistroTarea, RegistroTarea.operador_id == Personal.id)
        .join(Checklist, Checklist.id == RegistroTarea.checklist_id)
        .where(Checklist.fecha >= periodo.desde, Checklist.fecha <= min(periodo.hasta, hoy_dia))
        .group_by(Personal.id, Personal.nombre, Personal.apellido)
        .order_by(func.count(RegistroTarea.id).desc(), Personal.nombre)
    ).all()
    total_asignadas = sum(n for *_, n, _ in asignadas)
    total_completadas = sum(int(c) for *_, c in asignadas)

    incidentes = db.execute(
        select(Personal.id, Personal.nombre, Personal.apellido, func.count(Incidente.id))
        .join(Incidente, Incidente.usuario_id == Personal.id)
        .where(*_en_periodo(Incidente.fecha_reporte, periodo, True))
        .group_by(Personal.id, Personal.nombre, Personal.apellido)
        .order_by(func.count(Incidente.id).desc(), Personal.nombre)
        .limit(FILAS_RANKING)
    ).all()

    reclamos_por_cliente = dict(
        db.execute(
            select(Reclamo.cliente_id, func.count())
            .where(*_en_periodo(Reclamo.fecha_reclamo, periodo, False))
            .group_by(Reclamo.cliente_id)
        ).all()
    )
    clientes = db.execute(
        select(Cliente.id, Cliente.nombre, func.count(Salida.id))
        .join(Salida, Salida.cliente_id == Cliente.id)
        .where(*_en_periodo(Salida.fecha_reserva, periodo, False))
        .group_by(Cliente.id, Cliente.nombre)
        .order_by(func.count(Salida.id).desc(), Cliente.nombre)
        .limit(FILAS_RANKING)
    ).all()

    entregas = db.execute(
        select(Transportista.id, Transportista.razon_social, func.count(Salida.id))
        .join(Salida, Salida.transportista_id == Transportista.id)
        .where(*_en_periodo(Salida.fecha_reserva, periodo, False))
        .group_by(Transportista.id, Transportista.razon_social)
        .order_by(func.count(Salida.id).desc(), Transportista.razon_social)
        .limit(FILAS_RANKING)
    ).all()

    # Certificaciones vigentes (activas, sin anular) de transportistas activos.
    certificaciones = {"vigente": 0, "por_vencer": 0, "vencida": 0}
    for (vence,) in db.execute(
        select(CertificacionTransportista.fecha_vencimiento)
        .join(Transportista, Transportista.id == CertificacionTransportista.transportista_id)
        .where(
            Transportista.activo.is_(True),
            CertificacionTransportista.activa.is_(True),
            CertificacionTransportista.anulada.is_(False),
        )
    ).all():
        dias = (vence - hoy_dia).days
        certificaciones["vencida" if dias < 0 else "por_vencer" if dias <= 30 else "vigente"] += 1

    return schemas.PanelPersonas(
        periodo=periodo,
        personal_activo=personal_activo,
        personal_inactivo=personal_inactivo,
        aptitudes_vencidas=sum(1 for v in vencimientos if v.estado == VENCIDO),
        aptitudes_proximas=sum(1 for v in vencimientos if v.estado == PROXIMO),
        clientes_activos=clientes_activos,
        clientes_inactivos=clientes_inactivos,
        transportistas_activos=transportistas_activos,
        transportistas_inactivos=transportistas_inactivos,
        certificaciones_transporte_vencidas=certificaciones["vencida"],
        tareas_asignadas=total_asignadas,
        tareas_completadas=total_completadas,
        cumplimiento_tareas=_porcentaje(total_completadas, total_asignadas),
        personal_por_rol=[
            schemas.Conteo(clave=clave, etiqueta=etiqueta, valor=cantidad)
            for (clave, etiqueta), cantidad in sorted(roles.items(), key=lambda par: -par[1])
        ],
        cumplimiento_por_operador=[
            schemas.Conteo(
                clave=str(persona_id),
                etiqueta=_nombre_persona(nombre, apellido),
                valor=_porcentaje(int(c), n) or 0.0,
                detalle=f"{int(c)} de {_plural(n, 'tarea', 'tareas')}",
            )
            for persona_id, nombre, apellido, n, c in asignadas[:FILAS_RANKING]
        ],
        incidentes_por_persona=[
            schemas.Conteo(clave=str(persona_id), etiqueta=_nombre_persona(nombre, apellido), valor=cantidad)
            for persona_id, nombre, apellido, cantidad in incidentes
        ],
        clientes_con_mas_salidas=[
            schemas.Conteo(
                clave=str(cliente_id),
                etiqueta=nombre,
                valor=cantidad,
                detalle=(
                    f"{_plural(cantidad, 'salida', 'salidas')} · "
                    f"{_plural(reclamos_por_cliente[cliente_id], 'reclamo', 'reclamos')}"
                    if reclamos_por_cliente.get(cliente_id)
                    else _plural(cantidad, "salida", "salidas")
                ),
            )
            for cliente_id, nombre, cantidad in clientes
        ],
        entregas_por_transportista=[
            schemas.Conteo(clave=str(tid), etiqueta=razon, valor=cantidad)
            for tid, razon, cantidad in entregas
        ],
        certificaciones_transporte=[
            schemas.Conteo(clave="vigente", etiqueta="Vigentes", valor=certificaciones["vigente"]),
            schemas.Conteo(clave="por_vencer", etiqueta="Vencen en 30 días o menos", valor=certificaciones["por_vencer"]),
            schemas.Conteo(clave="vencida", etiqueta="Vencidas", valor=certificaciones["vencida"]),
        ],
        aptitudes_atencion=aptitudes_atencion,
    )


# ─────────────────────────────── Inicio ───────────────────────────────

# ──────────────────────────────── Inicio ────────────────────────────────


def _cifra(
    clave: str,
    etiqueta: str,
    valor: float,
    link: Optional[str] = None,
    tono_si_hay: schemas.Tono = "neutro",
    detalle: Optional[str] = None,
) -> schemas.CifraHoy:
    """Una cifra del día: en `tono_si_hay` si es mayor que cero; si no, neutra."""
    return schemas.CifraHoy(
        clave=clave,
        etiqueta=etiqueta,
        valor=valor,
        detalle=detalle,
        link=link,
        tono=tono_si_hay if valor else "neutro",
    )


def _checklist_de_hoy(db: Session, usuario: Personal, hoy_dia: date, meta: int) -> schemas.ChecklistHoy:
    """Las tareas de limpieza de hoy, con las de los planes que todavía no
    tienen checklist creado: es la misma lista que ve el operador en
    "Checklist diario" (y con su mismo alcance: un operador, solo las suyas)."""
    tareas = listar_tareas_del_dia(db, hoy_dia, usuario).tareas
    completadas = sum(1 for t in tareas if t.completado)

    por_momento = []
    for clave, etiqueta in ETIQUETA_MOMENTO_TAREA.items():
        del_momento = [t for t in tareas if (t.tipo or "") == clave]
        if del_momento:
            por_momento.append(
                schemas.Avance(
                    clave=clave,
                    etiqueta=etiqueta,
                    cumplen=sum(1 for t in del_momento if t.completado),
                    total=len(del_momento),
                )
            )

    pendientes = [
        schemas.FilaAtencion(
            clave=f"tarea-{t.id}-{t.equipo_id}",
            titulo=t.nombre,
            # "Plan · Operador": siempre las dos partes, el frontend las separa.
            detalle=f"{t.plan_nombre or 'Sin plan'} · "
            f"{t.reemplazado_por_nombre or t.operador_nombre or 'Sin asignar'}",
            tono="alerta",
            estado=ETIQUETA_MOMENTO_TAREA.get(t.tipo or "", "Pendiente"),
            link="/checklist",
        )
        for t in tareas
        if not t.completado
    ]

    return schemas.ChecklistHoy(
        total=len(tareas),
        completadas=completadas,
        porcentaje=_porcentaje(completadas, len(tareas)),
        meta=meta,
        por_momento=por_momento,
        pendientes=pendientes[:FILAS_LISTA],
        pendientes_total=len(pendientes),
    )


def _vencen_hoy(db: Session, hoy_dia: date) -> list[schemas.FilaAtencion]:
    """Lo que vence hoy: lotes de insumo con saldo, aptitudes del personal,
    calibraciones y mantenimientos, y documentos."""
    filas = [
        schemas.FilaAtencion(
            clave=f"lote-insumo-{lote.lote_insumo_id}",
            titulo=f"{lote.insumo_nombre} · lote {lote.numero_lote}",
            detalle=lote.proveedor_nombre,
            tono="peligro",
            estado="Lote de insumo",
            link="/stock-insumos",
        )
        for lote in lotes_insumo_services.stock_por_lote(db)
        if lote.saldo > 0 and lote.fecha_vencimiento == hoy_dia
    ]
    filas += [
        schemas.FilaAtencion(
            clave=v.id_vencimiento,
            titulo=f"{v.detalle} · {v.sujeto}",
            tono="peligro",
            estado=ETIQUETA_TIPO_VENCIMIENTO.get(v.tipo, v.tipo),
            link=v.link_destino,
        )
        for v in vencimientos_services.listar_vencimientos(db)
        if v.dias_restantes == 0
    ]
    return filas


def panel_inicio(db: Session, usuario: Personal, administra: bool) -> schemas.PanelInicio:
    """Solo lo del día de hoy: el checklist, lo que se produjo, lo que entró y
    salió, lo que se reportó y lo que vence hoy.

    Las cifras salen de los mismos cálculos de los paneles de cada área,
    pedidos con el período de hoy, así el inicio y los paneles nunca dicen
    cosas distintas. Quien solo opera ve el checklist, Producción y Calidad,
    con el mismo alcance que en esos paneles (sus tareas, sus reportes).
    """
    hoy_dia = hoy()
    periodo = schemas.Periodo(desde=hoy_dia, hasta=hoy_dia)
    grupos: list[schemas.GrupoHoy] = []

    produccion = panel_produccion(db, periodo, None, administra)
    producido_hoy = [d for d in produccion.produccion_por_dia if d.fecha == hoy_dia]
    grupos.append(
        schemas.GrupoHoy(
            clave="produccion",
            titulo="Producción",
            cifras=[
                _cifra("iniciados", "Lotes iniciados", produccion.lotes_iniciados, "/lotes"),
                _cifra("terminados", "Lotes terminados", produccion.lotes_terminados, "/lotes"),
                _cifra("salidas", "Salidas registradas", produccion.salidas_registradas, "/salidas"),
            ],
            producido=producido_hoy,
        )
    )

    if administra:
        inventario = panel_inventario(db, periodo, None)
        grupos.append(
            schemas.GrupoHoy(
                clave="inventario",
                titulo="Inventario",
                cifras=[
                    _cifra("recibidos", "Lotes de insumo recibidos", inventario.lotes_recibidos, "/stock-insumos"),
                ],
            )
        )

    calidad = panel_calidad(db, periodo, None, usuario, administra)
    grupos.append(
        schemas.GrupoHoy(
            clave="calidad",
            titulo="Calidad",
            cifras=[
                _cifra(
                    "incidentes",
                    "Incidentes reportados",
                    calidad.incidentes_reportados,
                    "/incidentes" if administra else "/incidentes/reportar",
                    "alerta",
                ),
                _cifra("cerrados", "Incidentes cerrados", calidad.cerrados_periodo,
                       "/incidentes" if administra else "/incidentes/reportar"),
                _cifra("reclamos", "Reclamos recibidos", calidad.reclamos, "/reclamos", "alerta"),
                _cifra("retiros", "Retiros iniciados", produccion.retiros_periodo, "/retiros", "peligro"),
            ],
        )
    )

    return schemas.PanelInicio(
        fecha=hoy_dia,
        checklist=_checklist_de_hoy(db, usuario, hoy_dia, obtener_meta_cumplimiento_limpieza(db)),
        grupos=grupos,
        vencen_hoy=_vencen_hoy(db, hoy_dia) if administra else None,
    )
