from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora, hoy
from src.lotes import exceptions, schemas
from src.lotes.constants import (
    ESTADO_CANCELADO,
    ESTADO_EN_PROCESO,
    ESTADO_TERMINADO,
    ESTADOS_LOTE,
    ESTADOS_LOTE_CERRADOS,
    PREFIJO_NUMERO_LOTE,
    TIPO_CONSUMO_DESPERDICIO,
    TIPO_CONSUMO_REAL,
)
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo.models import LoteInsumo
from src.lotesInsumo.services import saldo_lote_insumo
from src.personal.models import Personal
from src.productos.models import Producto
from src.recetas.models import Receta, RecetaInsumo, TareaReceta, TareaRecetaInsumo
from src.recetas.services import calcular_factor, version_vigente

_MILESIMA = Decimal("0.001")
CERO = Decimal("0.000")


def _cantidad_legible(valor: Decimal) -> str:
    """12.000 -> "12", 2.500 -> "2,5": formato argentino para los mensajes.

    `str(Decimal("12.000"))` da "12.000", que en es-AR se lee como doce mil.
    """
    texto = f"{valor:,.3f}".rstrip("0").rstrip(".")
    return texto.replace(",", "_").replace(".", ",").replace("_", ".")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_MILESIMA)


# --------------------------------------------------------------------------
# Lectura y reglas de estado
# --------------------------------------------------------------------------

def _opciones():
    return (
        selectinload(LoteProducto.producto),
        selectinload(LoteProducto.version_receta),
        selectinload(LoteProducto.checklist).selectinload(ChecklistProduccion.tarea),
        selectinload(LoteProducto.checklist)
        .selectinload(ChecklistProduccion.consumos)
        .selectinload(ConsumoInsumo.lote_insumo)
        .selectinload(LoteInsumo.insumo),
        selectinload(LoteProducto.checklist)
        .selectinload(ChecklistProduccion.consumos)
        .selectinload(ConsumoInsumo.lote_insumo)
        .selectinload(LoteInsumo.proveedor),
    )


def obtener_lote(db: Session, lote_id: int) -> LoteProducto:
    lote = db.scalar(
        select(LoteProducto).where(LoteProducto.id == lote_id).options(*_opciones())
    )
    if lote is None:
        raise exceptions.LoteNoEncontrado()
    return lote


def _exigir_abierto(lote: LoteProducto) -> None:
    """Un lote terminado o cancelado es de solo lectura."""
    if lote.estado in ESTADOS_LOTE_CERRADOS:
        raise exceptions.LoteCerrado()


def _item_del_lote(lote: LoteProducto, item_id: int) -> ChecklistProduccion:
    for item in lote.checklist:
        if item.id == item_id:
            return item
    raise exceptions.ItemNoEncontrado()


# --------------------------------------------------------------------------
# Crear lote
# --------------------------------------------------------------------------

def generar_numero_lote(db: Session, referencia: datetime | None = None) -> str:
    """`LP-AAAAMMDD-NNN`: contador diario. El UNIQUE de la base cubre carreras."""
    fecha = (referencia or ahora()).strftime("%Y%m%d")
    prefijo = f"{PREFIJO_NUMERO_LOTE}-{fecha}-"
    existentes = db.scalars(
        select(LoteProducto.numero_lote).where(LoteProducto.numero_lote.like(f"{prefijo}%"))
    ).all()
    sufijos = [
        int(numero[len(prefijo):])
        for numero in existentes
        if numero[len(prefijo):].isdigit()
    ]
    return f"{prefijo}{(max(sufijos) if sufijos else 0) + 1:03d}"


def crear_lote(
    db: Session, datos: schemas.LoteCreate, usuario: Personal | None = None
) -> LoteProducto:
    """Crea el lote `en_proceso`, fija la versión de receta vigente y genera el checklist."""
    producto = db.get(Producto, datos.producto_id)
    if producto is None or not producto.activo:
        raise exceptions.ProductoNoEncontrado()

    receta = db.scalar(
        select(Receta).where(Receta.producto_id == producto.id, Receta.activo.is_(True))
    )
    version = version_vigente(db, receta.id) if receta else None
    if version is None:
        raise exceptions.ProductoSinReceta()

    tareas = list(
        db.scalars(
            select(TareaReceta)
            .where(TareaReceta.version_receta_id == version.id)
            .order_by(TareaReceta.orden)
        ).all()
    )
    # Mismo cálculo que la vista de escalado de la receta.
    factor, cantidad_objetivo = calcular_factor(
        version.rendimiento, datos.cantidad_objetivo, datos.factor
    )

    for _ in range(5):
        lote = LoteProducto(
            numero_lote=generar_numero_lote(db),
            producto=producto,
            version_receta_id=version.id,
            estado=ESTADO_EN_PROCESO,
            cantidad_objetivo=cantidad_objetivo,
            factor_escala=factor,
            creado_por_id=usuario.id if usuario else None,
        )
        for tarea in tareas:
            ChecklistProduccion(lote=lote, tarea=tarea)
        db.add(lote)
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            if "numero_lote" not in str(error.orig).lower():
                raise
            continue
        return obtener_lote(db, lote.id)
    raise exceptions.NumeroLoteNoGenerado()


# --------------------------------------------------------------------------
# Checklist y consumos
# --------------------------------------------------------------------------

def completar_item(
    db: Session, lote_id: int, item_id: int, usuario: Personal
) -> LoteProducto:
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    item = _item_del_lote(lote, item_id)
    if item.completado_en is not None:
        raise exceptions.ItemYaCompletado()
    item.completado_por_id = usuario.id
    item.completado_en = ahora()
    db.commit()
    return obtener_lote(db, lote_id)


def _planificado(db: Session, lote: LoteProducto, item: ChecklistProduccion, insumo_id: int):
    """Cantidad planificada de un insumo en una tarea, escalada al lote."""
    cantidad = db.scalar(
        select(TareaRecetaInsumo.cantidad)
        .join(RecetaInsumo, RecetaInsumo.id == TareaRecetaInsumo.receta_insumo_id)
        .where(
            TareaRecetaInsumo.tarea_receta_id == item.tarea_receta_id,
            RecetaInsumo.insumo_id == insumo_id,
        )
    )
    if cantidad is None:
        return None
    return _q(Decimal(cantidad) * Decimal(lote.factor_escala or 1))


def registrar_consumo(
    db: Session,
    lote_id: int,
    item_id: int,
    datos: schemas.ConsumoCreate,
    usuario: Personal,
) -> tuple[ConsumoInsumo, list[str]]:
    """Registra un consumo real o un desperdicio. Devuelve el consumo y las advertencias.

    Un saldo insuficiente NO bloquea: se advierte y el consumo se guarda.
    """
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    item = _item_del_lote(lote, item_id)

    lote_insumo = db.scalar(
        select(LoteInsumo)
        .where(LoteInsumo.id == datos.lote_insumo_id)
        .options(selectinload(LoteInsumo.insumo), selectinload(LoteInsumo.proveedor))
    )
    if lote_insumo is None:
        raise exceptions.LoteInsumoNoEncontrado()
    if not lote_insumo.activo:
        raise exceptions.LoteInsumoDadoDeBaja()

    planificado = _planificado(db, lote, item, lote_insumo.insumo_id)
    if planificado is None:
        raise exceptions.InsumoNoPrevisto()

    advertencias: list[str] = []
    cantidad = _q(datos.cantidad)
    saldo = saldo_lote_insumo(db, lote_insumo)
    if cantidad > saldo:
        advertencias.append(
            f"Stock insuficiente en el lote {lote_insumo.numero_lote}: "
            f"saldo {_cantidad_legible(saldo)}, se consumen {_cantidad_legible(cantidad)}."
        )
    if lote_insumo.fecha_vencimiento is not None and lote_insumo.fecha_vencimiento < hoy():
        advertencias.append(
            f"El lote {lote_insumo.numero_lote} está vencido "
            f"({lote_insumo.fecha_vencimiento.isoformat()})."
        )
    if datos.tipo == TIPO_CONSUMO_REAL:
        ya_usado = sum(
            (
                _q(c.cantidad)
                for c in item.consumos
                if c.tipo == TIPO_CONSUMO_REAL
                and c.lote_insumo.insumo_id == lote_insumo.insumo_id
            ),
            CERO,
        )
        if ya_usado + cantidad > planificado:
            advertencias.append(
                f"El consumo real de {lote_insumo.insumo.nombre} supera lo planificado "
                f"para la tarea ({_cantidad_legible(ya_usado + cantidad)} de "
                f"{_cantidad_legible(planificado)})."
            )

    consumo = ConsumoInsumo(
        checklist=item,
        lote_insumo=lote_insumo,
        cantidad=datos.cantidad,
        tipo=datos.tipo,
        motivo=datos.motivo,
        registrado_por_id=usuario.id,
    )
    db.add(consumo)
    db.commit()
    db.refresh(consumo)
    return consumo, advertencias


def cerrar_lote(
    db: Session, lote_id: int, datos: schemas.LoteCierre
) -> LoteProducto:
    """`terminado`: checklist completo y cantidad final producida cargada."""
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    if any(item.completado_en is None for item in lote.checklist):
        raise exceptions.ChecklistIncompleto()
    if datos.cantidad_producida <= 0:
        raise exceptions.CantidadProducidaInvalida()
    lote.cantidad_producida = datos.cantidad_producida
    lote.estado = ESTADO_TERMINADO
    lote.fecha_cierre = ahora()
    db.commit()
    return obtener_lote(db, lote_id)


def cancelar_lote(db: Session, lote_id: int, motivo: str) -> LoteProducto:
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    lote.estado = ESTADO_CANCELADO
    lote.motivo_cancelacion = motivo
    lote.fecha_cierre = ahora()
    db.commit()
    return obtener_lote(db, lote_id)


# --------------------------------------------------------------------------
# Listados y respuestas
# --------------------------------------------------------------------------

def _validar_rango(desde: date | None, hasta: date | None) -> None:
    if desde is not None and hasta is not None and desde > hasta:
        raise exceptions.RangoFechasInvalido()


def _filtrar(consulta, producto_id, estado, fecha_desde, fecha_hasta):
    if producto_id is not None:
        consulta = consulta.where(LoteProducto.producto_id == producto_id)
    if estado is not None:
        consulta = consulta.where(LoteProducto.estado == estado)
    if fecha_desde is not None:
        consulta = consulta.where(
            LoteProducto.fecha_inicio >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        consulta = consulta.where(
            LoteProducto.fecha_inicio
            < datetime.combine(fecha_hasta + timedelta(days=1), time.min)
        )
    return consulta


def listar_lotes(
    db: Session,
    producto_id: int | None = None,
    estado: str | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
) -> list[LoteProducto]:
    _validar_rango(fecha_desde, fecha_hasta)
    consulta = _filtrar(
        select(LoteProducto).options(*_opciones()),
        producto_id,
        estado,
        fecha_desde,
        fecha_hasta,
    )
    return list(
        db.scalars(consulta.order_by(LoteProducto.fecha_inicio.desc(), LoteProducto.id.desc())).all()
    )


def _nombre(persona: Personal | None) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def resumen(lote: LoteProducto) -> schemas.LoteResumen:
    return schemas.LoteResumen(
        id=lote.id,
        numero_lote=lote.numero_lote,
        producto_id=lote.producto_id,
        producto_nombre=lote.producto.nombre,
        unidad=lote.producto.unidad_medida.simbolo,
        version_receta_id=lote.version_receta_id,
        version_numero=lote.version_receta.numero if lote.version_receta else None,
        estado=lote.estado,
        cantidad_objetivo=lote.cantidad_objetivo,
        factor_escala=lote.factor_escala,
        cantidad_producida=lote.cantidad_producida,
        motivo_cancelacion=lote.motivo_cancelacion,
        creado_por_id=lote.creado_por_id,
        creado_por_nombre=_nombre(lote.creado_por),
        fecha_inicio=lote.fecha_inicio,
        fecha_cierre=lote.fecha_cierre,
        items_total=len(lote.checklist),
        items_completados=sum(1 for i in lote.checklist if i.completado_en is not None),
    )


def consumo_a_respuesta(
    consumo: ConsumoInsumo, advertencias: list[str] | None = None
) -> schemas.ConsumoResponse:
    lote_insumo = consumo.lote_insumo
    return schemas.ConsumoResponse(
        id=consumo.id,
        checklist_produccion_id=consumo.checklist_produccion_id,
        lote_insumo_id=consumo.lote_insumo_id,
        insumo_id=lote_insumo.insumo_id,
        insumo_nombre=lote_insumo.insumo.nombre,
        numero_lote_insumo=lote_insumo.numero_lote,
        proveedor_nombre=lote_insumo.proveedor.nombre,
        cantidad=consumo.cantidad,
        tipo=consumo.tipo,
        motivo=consumo.motivo,
        registrado_por_id=consumo.registrado_por_id,
        registrado_por_nombre=_nombre(consumo.registrado_por),
        registrado_en=consumo.registrado_en,
        advertencias=advertencias or [],
    )


def detalle(db: Session, lote: LoteProducto) -> schemas.LoteDetalle:
    """Checklist del lote con lo planificado (escalado) frente a lo consumido."""
    factor = Decimal(lote.factor_escala or 1)
    items = []
    for item in sorted(lote.checklist, key=lambda i: i.tarea.orden):
        asignaciones = db.scalars(
            select(TareaRecetaInsumo)
            .where(TareaRecetaInsumo.tarea_receta_id == item.tarea_receta_id)
            .options(
                selectinload(TareaRecetaInsumo.receta_insumo)
                .selectinload(RecetaInsumo.insumo)
            )
            .order_by(TareaRecetaInsumo.id)
        ).all()
        planificados = []
        for asignacion in asignaciones:
            insumo = asignacion.receta_insumo.insumo
            del_insumo = [c for c in item.consumos if c.lote_insumo.insumo_id == insumo.id]
            planificados.append(
                schemas.InsumoPlanificado(
                    insumo_id=insumo.id,
                    insumo_nombre=insumo.nombre,
                    unidad=asignacion.receta_insumo.unidad_medida.simbolo,
                    cantidad_planificada=_q(Decimal(asignacion.cantidad) * factor),
                    consumo_real=sum(
                        (_q(c.cantidad) for c in del_insumo if c.tipo == TIPO_CONSUMO_REAL), CERO
                    ),
                    desperdicio=sum(
                        (_q(c.cantidad) for c in del_insumo if c.tipo == TIPO_CONSUMO_DESPERDICIO),
                        CERO,
                    ),
                )
            )
        items.append(
            schemas.ItemChecklist(
                id=item.id,
                tarea_receta_id=item.tarea_receta_id,
                orden=item.tarea.orden,
                descripcion=item.tarea.descripcion,
                completado=item.completado_en is not None,
                completado_por_id=item.completado_por_id,
                completado_por_nombre=_nombre(item.completado_por),
                completado_en=item.completado_en,
                insumos=planificados,
                consumos=[consumo_a_respuesta(c) for c in item.consumos],
            )
        )
    return schemas.LoteDetalle(**resumen(lote).model_dump(), checklist=items)


def dashboard(
    db: Session,
    producto_id: int | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
) -> schemas.DashboardLotesResponse:
    _validar_rango(fecha_desde, fecha_hasta)
    filtro = _filtrar(select(LoteProducto), producto_id, None, fecha_desde, fecha_hasta)
    sub = filtro.subquery()

    conteos = {estado: 0 for estado in ESTADOS_LOTE}
    for estado, cantidad in db.execute(
        select(sub.c.estado, func.count(sub.c.id)).group_by(sub.c.estado)
    ).all():
        conteos[estado] = cantidad

    por_producto = [
        schemas.ProduccionPorProducto(
            producto=nombre,
            cantidad_producida=_q(total),
            cantidad_lotes=cantidad,
        )
        for nombre, total, cantidad in db.execute(
            select(
                Producto.nombre,
                func.coalesce(func.sum(sub.c.cantidad_producida), 0),
                func.count(sub.c.id),
            )
            .join(Producto, Producto.id == sub.c.producto_id)
            .where(sub.c.estado == ESTADO_TERMINADO)
            .group_by(Producto.nombre)
            .order_by(Producto.nombre)
        ).all()
    ]
    return schemas.DashboardLotesResponse(
        total_lotes=sum(conteos.values()),
        total_cantidad_producida=sum((p.cantidad_producida for p in por_producto), CERO),
        por_estado=[
            schemas.LoteResumenEstado(estado=e, cantidad=conteos[e]) for e in ESTADOS_LOTE
        ],
        por_producto=por_producto,
    )
