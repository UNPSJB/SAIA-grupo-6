from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, exists, func, or_, select
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
from src.ingredientes.models import Ingrediente
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo.models import LoteInsumo
from src.lotesInsumo.services import saldo_lote_insumo
from src.personal.models import Personal
from src.productos.models import Producto
from src.unidadMedida.models import UnidadMedida
from src.salidas.constants import (
    ESTADO_RESERVADO,
    ESTADO_DESPACHADO,
    ESTADO_ENTREGADO,
)
from src.salidas.models import Salida, calcular_cantidades
from src.recetas.models import Receta, RecetaIngrediente, TareaReceta, TareaRecetaIngrediente, VersionReceta
from src.recetas.services import calcular_factor, version_vigente
from src.unidadMedida.cantidades import es_cantidad_valida

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
        selectinload(LoteProducto.checklist).selectinload(ChecklistProduccion.asignado_a),
        selectinload(LoteProducto.checklist)
        .selectinload(ChecklistProduccion.consumos)
        .selectinload(ConsumoInsumo.lote_insumo)
        .selectinload(LoteInsumo.ingrediente),
        selectinload(LoteProducto.checklist)
        .selectinload(ChecklistProduccion.consumos)
        .selectinload(ConsumoInsumo.lote_insumo)
        .selectinload(LoteInsumo.proveedor),
        selectinload(LoteProducto.checklist)
        .selectinload(ChecklistProduccion.consumos)
        .selectinload(ConsumoInsumo.lote_insumo)
        .selectinload(LoteInsumo.insumo),
        # Salidas del lote para calcular producido/reservado/despachado/entregado/saldo.
        selectinload(LoteProducto.salidas).selectinload(Salida.cliente),
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


def _exigir_etapa_anterior_completa(lote: LoteProducto, item: ChecklistProduccion) -> None:
    """Las etapas se hacen en el orden de la receta: para registrar consumo o
    completar una, todas las anteriores tienen que estar completadas."""
    pendiente = min(
        (
            otro for otro in lote.checklist
            if otro.tarea.orden < item.tarea.orden and otro.completado_en is None
        ),
        key=lambda otro: otro.tarea.orden,
        default=None,
    )
    if pendiente is not None:
        raise exceptions.EtapaAnteriorPendiente(
            f"Primero hay que completar la etapa {pendiente.tarea.orden} "
            f"({pendiente.tarea.descripcion})."
        )


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


# --------------------------------------------------------------------------
# Asignación de tareas: quién ve qué lote y quién puede registrar cada tarea
# --------------------------------------------------------------------------

def administra(usuario: Personal | None) -> bool:
    return bool(usuario and (usuario.puede_administrar or usuario.es_super_admin))


def _persona_asignable(db: Session, persona_id: int) -> Personal:
    persona = db.get(Personal, persona_id)
    if persona is None or not persona.activo or not persona.puede_operar:
        raise exceptions.PersonaNoAsignable()
    return persona


def _exigir_puede_registrar(item: ChecklistProduccion, usuario: Personal) -> None:
    """Quien opera registra solo sus tareas o las que no tienen a nadie asignado."""
    if administra(usuario) or item.asignado_a_id in (None, usuario.id):
        return
    raise exceptions.TareaAsignadaAOtro()


def _condicion_visible(usuario: Personal):
    """Lotes que lista quien opera: solo los que están en proceso y tienen
    trabajo para esa persona, es decir alguna tarea asignada a ella (o que ya
    completó) o alguna pendiente sin asignar, que puede hacer cualquiera."""
    item = ChecklistProduccion
    return and_(
        LoteProducto.estado == ESTADO_EN_PROCESO,
        exists().where(
            item.lote_producto_id == LoteProducto.id,
            or_(
                item.asignado_a_id == usuario.id,
                item.completado_por_id == usuario.id,
                and_(item.asignado_a_id.is_(None), item.completado_en.is_(None)),
            ),
        ),
    )


def lote_visible(db: Session, lote_id: int, usuario: Personal | None) -> LoteProducto:
    """El lote, si quien pide lo puede ver (si no, como si no existiera).

    Un lote cerrado (terminado o cancelado) es de solo lectura y lo puede
    abrir cualquiera que opere: se llega a él desde una salida, un reclamo,
    un retiro o un incidente, que también son de quien opera. Lo que se
    restringe es el trabajo en curso: los lotes en proceso de otras personas.
    """
    lote = obtener_lote(db, lote_id)
    if usuario is None or administra(usuario) or lote.estado != ESTADO_EN_PROCESO:
        return lote
    visible = db.scalar(select(LoteProducto.id).where(LoteProducto.id == lote_id, _condicion_visible(usuario)))
    if visible is None:
        raise exceptions.LoteNoEncontrado()
    return lote


def asignar_tarea(
    db: Session, lote_id: int, item_id: int, datos: schemas.AsignacionTarea, usuario: Personal
) -> LoteProducto:
    """Asigna (o deja sin asignar) una tarea pendiente de un lote en proceso."""
    if not administra(usuario):
        raise exceptions.AsignacionSoloAdministra()
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    item = _item_del_lote(lote, item_id)
    if item.completado_en is not None:
        raise exceptions.ItemYaCompletado()
    item.asignado_a_id = (
        _persona_asignable(db, datos.asignado_a_id).id if datos.asignado_a_id is not None else None
    )
    db.commit()
    return obtener_lote(db, lote_id)


def crear_lote(
    db: Session, datos: schemas.LoteCreate, usuario: Personal | None = None
) -> LoteProducto:
    """Crea el lote `en_proceso`, fija la versión de receta vigente y genera el checklist."""
    responsable_id = None
    if datos.responsable_id is not None:
        if usuario is not None and not administra(usuario):
            raise exceptions.AsignacionSoloAdministra()
        responsable_id = _persona_asignable(db, datos.responsable_id).id
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
    # Un producto que se cuenta por piezas no se elabora en fracciones, ni
    # pidiendo la cantidad ni multiplicando la receta (10 panes × 1,33).
    if not es_cantidad_valida(cantidad_objetivo, producto.unidad_medida):
        raise exceptions.CantidadObjetivoNoEntera()

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
            ChecklistProduccion(lote=lote, tarea=tarea, asignado_a_id=responsable_id)
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
    _exigir_puede_registrar(item, usuario)
    _exigir_etapa_anterior_completa(lote, item)
    # La tarea usa como mínimo lo que pide la receta (escalado al lote). Los
    # desperdicios no cuentan: lo que se tiró no entró en el producto.
    faltan = [
        f"{p.ingrediente_nombre}: {_cantidad_legible(p.consumo_real)} de "
        f"{_cantidad_legible(p.cantidad_planificada)} {p.unidad}"
        for p in _planificados_del_item(db, lote, item)
        if p.consumo_real < p.cantidad_planificada
    ]
    if faltan:
        raise exceptions.ConsumoIncompleto(
            "Antes de completar la tarea registrá el consumo real de lo que pide la receta. Falta: "
            + "; ".join(faltan)
            + "."
        )
    item.completado_por_id = usuario.id
    item.completado_en = ahora()
    db.commit()
    return obtener_lote(db, lote_id)


def _planificado(db: Session, lote: LoteProducto, item: ChecklistProduccion, ingrediente_id: int):
    """Cantidad planificada de un ingrediente en una tarea, escalada al lote."""
    cantidad = db.scalar(
        select(TareaRecetaIngrediente.cantidad)
        .join(RecetaIngrediente, RecetaIngrediente.id == TareaRecetaIngrediente.receta_ingrediente_id)
        .where(
            TareaRecetaIngrediente.tarea_receta_id == item.tarea_receta_id,
            RecetaIngrediente.ingrediente_id == ingrediente_id,
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

    No se consume más que el saldo del lote de insumo (`StockInsuficiente`):
    si no alcanza, lo que falta se registra desde otro lote. Un lote vencido
    no se usa (`LoteInsumoVencido`). El exceso sobre lo planificado solo se
    advierte.
    """
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    item = _item_del_lote(lote, item_id)
    if item.completado_en is not None:
        raise exceptions.EtapaYaCompletada()
    _exigir_puede_registrar(item, usuario)
    _exigir_etapa_anterior_completa(lote, item)

    lote_insumo = db.scalar(
        select(LoteInsumo)
        .where(LoteInsumo.id == datos.lote_insumo_id)
        .options(
            selectinload(LoteInsumo.ingrediente),
            selectinload(LoteInsumo.insumo),
            selectinload(LoteInsumo.proveedor),
        )
    )
    if lote_insumo is None:
        raise exceptions.LoteInsumoNoEncontrado()
    if not lote_insumo.activo:
        raise exceptions.LoteInsumoDadoDeBaja()
    # Solo se produce con marcas homologadas: si la marca dejó de estar
    # aprobada (o se le venció la aprobación) después de recibir el lote, el
    # lote queda en stock pero no se usa hasta que se vuelva a homologar.
    from src.insumos.homologacion import motivo_no_utilizable

    motivo = motivo_no_utilizable(db, lote_insumo.insumo)
    if motivo is not None:
        raise exceptions.InsumoNoHomologado(motivo)

    planificado = _planificado(db, lote, item, lote_insumo.ingrediente_id)
    if planificado is None:
        raise exceptions.IngredienteNoPrevisto()
    _exigir_no_vencido(lote_insumo)

    advertencias: list[str] = []
    cantidad = _q(datos.cantidad)
    saldo = saldo_lote_insumo(db, lote_insumo)
    if cantidad > saldo:
        unidad = lote_insumo.ingrediente.unidad_medida
        sufijo = f" {unidad.simbolo}" if unidad else ""
        raise exceptions.StockInsuficiente(
            f"El lote {lote_insumo.numero_lote} no tiene saldo suficiente: quedan "
            f"{_cantidad_legible(max(saldo, CERO))}{sufijo} y se quieren consumir "
            f"{_cantidad_legible(cantidad)}{sufijo}. Registrá lo que falta desde otro lote."
        )
    if datos.tipo == TIPO_CONSUMO_REAL:
        ya_usado = sum(
            (
                _q(c.cantidad)
                for c in item.consumos
                if c.tipo == TIPO_CONSUMO_REAL
                and c.lote_insumo.ingrediente_id == lote_insumo.ingrediente_id
            ),
            CERO,
        )
        if ya_usado + cantidad > planificado:
            advertencias.append(
                f"El consumo real de {lote_insumo.ingrediente.nombre} supera lo planificado "
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


def _exigir_no_vencido(lote_insumo: LoteInsumo) -> None:
    """Un lote de insumo vencido no se usa en producción: queda para la baja."""
    vence = lote_insumo.fecha_vencimiento
    if vence is not None and vence < hoy():
        raise exceptions.LoteInsumoVencido(
            f"El lote {lote_insumo.numero_lote} venció el {vence.strftime('%d/%m/%Y')}: "
            "no se puede usar en producción. Elegí otro lote y registrá la baja de este."
        )


def _consumo_editable(
    db: Session, lote_id: int, consumo_id: int, usuario: Personal
) -> tuple[LoteProducto, ConsumoInsumo]:
    """El consumo, si todavía se puede corregir: lote abierto, etapa pendiente
    y la persona puede registrar esa etapa (suya, sin asignar o admin)."""
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    consumo = db.get(ConsumoInsumo, consumo_id)
    if consumo is None or consumo.checklist is None or consumo.checklist.lote_producto_id != lote.id:
        raise exceptions.ConsumoNoEncontrado()
    item = consumo.checklist
    if item.completado_en is not None:
        raise exceptions.EtapaYaCompletada()
    _exigir_puede_registrar(item, usuario)
    return lote, consumo


def modificar_consumo(
    db: Session, lote_id: int, consumo_id: int, datos: schemas.ConsumoUpdate, usuario: Personal
) -> LoteProducto:
    """Corrige la cantidad (y el motivo) de un consumo de una etapa pendiente.

    El nuevo valor tampoco puede superar el saldo del lote de insumo, contando
    lo que este mismo consumo ya había descontado. El cambio queda en la
    auditoría (todas las entidades se auditan).
    """
    _, consumo = _consumo_editable(db, lote_id, consumo_id, usuario)
    cantidad = _q(datos.cantidad)
    # Bajar lo registrado de un lote que venció después se puede; sumarle, no.
    if cantidad > _q(consumo.cantidad):
        _exigir_no_vencido(consumo.lote_insumo)
    disponible = saldo_lote_insumo(db, consumo.lote_insumo) + _q(consumo.cantidad)
    if cantidad > disponible:
        unidad = consumo.lote_insumo.ingrediente.unidad_medida
        sufijo = f" {unidad.simbolo}" if unidad else ""
        raise exceptions.StockInsuficiente(
            f"El lote {consumo.lote_insumo.numero_lote} no tiene saldo suficiente: como máximo "
            f"{_cantidad_legible(max(disponible, CERO))}{sufijo} para este consumo."
        )
    consumo.cantidad = cantidad
    consumo.motivo = datos.motivo if consumo.tipo == TIPO_CONSUMO_DESPERDICIO else None
    db.commit()
    return obtener_lote(db, lote_id)


def eliminar_consumo(db: Session, lote_id: int, consumo_id: int, usuario: Personal) -> LoteProducto:
    """Borra un consumo mal cargado de una etapa pendiente: lo consumido vuelve
    al saldo del lote de insumo. Queda registrado en la auditoría."""
    _, consumo = _consumo_editable(db, lote_id, consumo_id, usuario)
    db.delete(consumo)
    db.commit()
    db.expire_all()
    return obtener_lote(db, lote_id)


def cerrar_lote(
    db: Session, lote_id: int, datos: schemas.LoteCierre
) -> LoteProducto:
    """`terminado`: checklist completo y cantidad final producida cargada.

    Si la versión de la receta tiene `vida_util_dias`, se calcula y guarda
    automáticamente `fecha_vencimiento = fecha_cierre.date() + timedelta(days=vida_util_dias)`.
    Si es `None`, se usa la `fecha_vencimiento` cargada a mano (o queda `None`).
    """
    lote = obtener_lote(db, lote_id)
    _exigir_abierto(lote)
    if any(item.completado_en is None for item in lote.checklist):
        raise exceptions.ChecklistIncompleto()
    if datos.cantidad_producida <= 0:
        raise exceptions.CantidadProducidaInvalida()
    if not es_cantidad_valida(datos.cantidad_producida, lote.producto.unidad_medida):
        raise exceptions.CantidadProducidaNoEntera()
    lote.cantidad_producida = datos.cantidad_producida
    lote.estado = ESTADO_TERMINADO
    lote.fecha_cierre = ahora()

    if lote.version_receta and lote.version_receta.vida_util_dias is not None:
        lote.fecha_vencimiento = lote.fecha_cierre.date() + timedelta(
            days=lote.version_receta.vida_util_dias
        )
    else:
        if datos.fecha_vencimiento is not None and datos.fecha_vencimiento < lote.fecha_cierre.date():
            raise exceptions.VencimientoAnteriorAlCierre()
        lote.fecha_vencimiento = datos.fecha_vencimiento

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
    usuario: Personal | None = None,
) -> list[LoteProducto]:
    """Quien opera ve solo los lotes donde tiene trabajo (ver `_condicion_visible`)."""
    _validar_rango(fecha_desde, fecha_hasta)
    consulta = _filtrar(
        select(LoteProducto).options(*_opciones()),
        producto_id,
        estado,
        fecha_desde,
        fecha_hasta,
    )
    if usuario is not None and not administra(usuario):
        consulta = consulta.where(_condicion_visible(usuario))
    return list(
        db.scalars(consulta.order_by(LoteProducto.fecha_inicio.desc(), LoteProducto.id.desc())).all()
    )


def _nombre(persona: Personal | None) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def resumen(
    lote: LoteProducto, db: Session | None = None
) -> schemas.LoteResumen:
    # Retiro asociado al lote (si existe y se pide con db).
    retiro_id = None
    retiro_estado = None
    if db is not None:
        from src.retiros.models import Retiro

        retiro = db.scalar(select(Retiro).where(Retiro.lote_id == lote.id))
        if retiro is not None:
            retiro_id = retiro.id
            retiro_estado = retiro.estado

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
        fecha_vencimiento=lote.fecha_vencimiento,
        items_total=len(lote.checklist),
        items_completados=sum(1 for i in lote.checklist if i.completado_en is not None),
        retirado=lote.retirado,
        reservado=lote.reservado,
        despachado=lote.despachado,
        entregado=lote.entregado,
        en_revision=lote.en_revision,
        desechado=lote.desechado,
        saldo=lote.saldo,
        estado_lote=lote.estado_lote,
        retiro_id=retiro_id,
        retiro_estado=retiro_estado,
        vida_util_dias=lote.version_receta.vida_util_dias if lote.version_receta else None,
    )


def consumo_a_respuesta(
    consumo: ConsumoInsumo, advertencias: list[str] | None = None
) -> schemas.ConsumoResponse:
    lote_insumo = consumo.lote_insumo
    return schemas.ConsumoResponse(
        id=consumo.id,
        checklist_produccion_id=consumo.checklist_produccion_id,
        lote_insumo_id=consumo.lote_insumo_id,
        ingrediente_id=lote_insumo.ingrediente_id,
        ingrediente_nombre=lote_insumo.ingrediente.nombre,
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


def _planificados_del_item(
    db: Session, lote: LoteProducto, item: ChecklistProduccion
) -> list[schemas.IngredientePlanificado]:
    """Lo que pide la receta para la tarea (escalado al lote) frente a lo consumido."""
    factor = Decimal(lote.factor_escala or 1)
    asignaciones = db.scalars(
        select(TareaRecetaIngrediente)
        .where(TareaRecetaIngrediente.tarea_receta_id == item.tarea_receta_id)
        .options(
            selectinload(TareaRecetaIngrediente.receta_ingrediente)
            .selectinload(RecetaIngrediente.ingrediente)
        )
        .order_by(TareaRecetaIngrediente.id)
    ).all()
    planificados = []
    for asignacion in asignaciones:
        ingrediente = asignacion.receta_ingrediente.ingrediente
        del_ingrediente = [c for c in item.consumos if c.lote_insumo.ingrediente_id == ingrediente.id]
        planificados.append(
            schemas.IngredientePlanificado(
                ingrediente_id=ingrediente.id,
                ingrediente_nombre=ingrediente.nombre,
                unidad=asignacion.receta_ingrediente.unidad_medida.simbolo,
                cantidad_planificada=_q(Decimal(asignacion.cantidad) * factor),
                consumo_real=sum(
                    (_q(c.cantidad) for c in del_ingrediente if c.tipo == TIPO_CONSUMO_REAL), CERO
                ),
                desperdicio=sum(
                    (_q(c.cantidad) for c in del_ingrediente if c.tipo == TIPO_CONSUMO_DESPERDICIO),
                    CERO,
                ),
            )
        )
    return planificados


def detalle(db: Session, lote: LoteProducto) -> schemas.LoteDetalle:
    """Checklist del lote con lo planificado (escalado) frente a lo consumido."""
    items = []
    for item in sorted(lote.checklist, key=lambda i: i.tarea.orden):
        planificados = _planificados_del_item(db, lote, item)
        items.append(
            schemas.ItemChecklist(
                id=item.id,
                tarea_receta_id=item.tarea_receta_id,
                orden=item.tarea.orden,
                descripcion=item.tarea.descripcion,
                procedimiento=item.tarea.procedimiento,
                completado=item.completado_en is not None,
                completado_por_id=item.completado_por_id,
                completado_por_nombre=_nombre(item.completado_por),
                completado_en=item.completado_en,
                asignado_a_id=item.asignado_a_id,
                asignado_a_nombre=_nombre(item.asignado_a),
                ingredientes=planificados,
                consumos=[consumo_a_respuesta(c) for c in item.consumos],
            )
        )
    rotulado = None
    if lote.estado == ESTADO_TERMINADO:
        from src.rotulado.services import borrador_completo_del_lote

        rotulado = borrador_completo_del_lote(db, lote.id) is not None
    return schemas.LoteDetalle(
        **resumen(lote, db).model_dump(), checklist=items, rotulado_completo=rotulado
    )


def impacto_retiro(db: Session, lote_id: int) -> schemas.ImpactoRetiro:
    """Impacto de retirar un lote: reservas a cancelar y salidas afectadas."""
    lote = db.get(LoteProducto, lote_id)
    if lote is None:
        from src.lotes import exceptions as lotes_exceptions

        raise lotes_exceptions.LoteNoEncontrado()

    salidas = list(lote.salidas) if lote.salidas is not None else []
    reservas = [s for s in salidas if s.estado == ESTADO_RESERVADO]
    afectadas = [s for s in salidas if s.estado in (ESTADO_DESPACHADO, ESTADO_ENTREGADO)]

    salidas_afectadas_resumen = []
    for salida in afectadas:
        cliente = salida.cliente
        transportista = salida.transportista
        unidad = (
            salida.lote.producto.unidad_medida.simbolo
            if salida.lote.producto and salida.lote.producto.unidad_medida
            else ""
        )
        salidas_afectadas_resumen.append(
            schemas.SalidaAfectadaResumen(
                salida_id=salida.id,
                cliente_id=cliente.id,
                cliente_nombre=cliente.nombre,
                cantidad_con_unidad=_cantidad_con_unidad_lotes(salida.cantidad, unidad),
                unidad_medida=unidad,
                transportista=(
                    transportista.razon_social if transportista else "Retira en planta"
                ),
                estado=salida.estado,
            )
        )

    calculo = calcular_cantidades(
        lote.cantidad_producida, salidas, lote.retirado
    )
    unidad = (
        lote.producto.unidad_medida.simbolo
        if lote.producto and lote.producto.unidad_medida
        else ""
    )

    return schemas.ImpactoRetiro(
        lote_id=lote.id,
        lote_codigo=lote.numero_lote,
        lote_producto_nombre=lote.producto.nombre,
        reservas_a_cancelar=len(reservas),
        salidas_afectadas=salidas_afectadas_resumen,
        total_afectadas=len(afectadas),
        saldo_en_planta=_cantidad_con_unidad_lotes(calculo["saldo"], unidad),
        en_revision=_cantidad_con_unidad_lotes(calculo["en_revision"], unidad),
    )


def _cantidad_con_unidad_lotes(cantidad, unidad: Optional[str]) -> str:
    from src.salidas.models import formatear_cantidad

    texto = formatear_cantidad(cantidad)
    if unidad:
        return f"{texto} {unidad}"
    return texto


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
            unidad=unidad,
        )
        for nombre, unidad, total, cantidad in db.execute(
            select(
                Producto.nombre,
                UnidadMedida.simbolo,
                func.coalesce(func.sum(sub.c.cantidad_producida), 0),
                func.count(sub.c.id),
            )
            .join(Producto, Producto.id == sub.c.producto_id)
            .join(UnidadMedida, UnidadMedida.id == Producto.unidad_medida_id)
            .where(sub.c.estado == ESTADO_TERMINADO)
            .group_by(Producto.nombre, UnidadMedida.simbolo)
            .order_by(Producto.nombre)
        ).all()
    ]
    # Totales separados por unidad: kilos con kilos, unidades con unidades.
    totales: dict[str, Decimal] = {}
    for p in por_producto:
        totales[p.unidad] = totales.get(p.unidad, CERO) + p.cantidad_producida
    return schemas.DashboardLotesResponse(
        total_lotes=sum(conteos.values()),
        total_cantidad_producida=sum((p.cantidad_producida for p in por_producto), CERO),
        total_por_unidad=[
            schemas.TotalPorUnidad(unidad=u, cantidad=c) for u, c in sorted(totales.items())
        ],
        por_estado=[
            schemas.LoteResumenEstado(estado=e, cantidad=conteos[e]) for e in ESTADOS_LOTE
        ],
        por_producto=por_producto,
    )


def obtener_timeline_lote(db: Session, lote_id: int) -> schemas.LoteTimelineResponse:
    lote = db.scalar(
        select(LoteProducto)
        .where(LoteProducto.id == lote_id)
        .options(
            selectinload(LoteProducto.creado_por),
            selectinload(LoteProducto.producto).selectinload(Producto.unidad_medida),
            selectinload(LoteProducto.version_receta),
            selectinload(LoteProducto.checklist).selectinload(ChecklistProduccion.tarea),
            selectinload(LoteProducto.checklist).selectinload(ChecklistProduccion.completado_por),
            selectinload(LoteProducto.checklist)
            .selectinload(ChecklistProduccion.consumos)
            .selectinload(ConsumoInsumo.lote_insumo)
            .selectinload(LoteInsumo.ingrediente)
            .selectinload(Ingrediente.unidad_medida),
            selectinload(LoteProducto.checklist)
            .selectinload(ChecklistProduccion.consumos)
            .selectinload(ConsumoInsumo.lote_insumo)
            .selectinload(LoteInsumo.proveedor),
            selectinload(LoteProducto.salidas),
        )
    )
    if lote is None:
        raise exceptions.LoteNoEncontrado()

    nodos: list[schemas.NodoTimelineResponse] = []

    # 1. Nodo de Inicio (tipo='inicio')
    numero_ver = None
    if lote.version_receta:
        numero_ver = getattr(lote.version_receta, "numero_version", None) or getattr(lote.version_receta, "numero", None)
    subtitulo_inicio = f"Receta v{numero_ver}" if numero_ver is not None else None

    nodo_inicio = schemas.NodoTimelineResponse(
        id="inicio",
        orden=1,
        tipo="inicio",
        titulo="Inicio de Producción",
        subtitulo=subtitulo_inicio,
        fecha_hora=lote.fecha_inicio,
        estado="completado",
        tiene_desvio=False,
        detalle=schemas.DetalleNodoTimeline(
            operario_nombre=_nombre(lote.creado_por),
            rendimiento=schemas.RendimientoTimeline(
                cantidad_objetivo=lote.cantidad_objetivo,
                cantidad_producida=None,
                porcentaje_rendimiento=None,
            ),
        ),
    )
    nodos.append(nodo_inicio)

    # 2. Nodos Intermedios (tipo='tarea', uno por cada item en lote.checklist)
    checklist_ordenado = sorted(
        lote.checklist,
        key=lambda item: (item.tarea.orden if item.tarea and item.tarea.orden is not None else item.id),
    )

    primera_no_completada_encontrada = False
    for i, item in enumerate(checklist_ordenado, start=2):
        if item.completado_en is not None:
            estado_tarea: schemas.EstadoNodoTimeline = "completado"
        elif not primera_no_completada_encontrada and lote.estado == ESTADO_EN_PROCESO:
            estado_tarea = "en_proceso"
            primera_no_completada_encontrada = True
        else:
            estado_tarea = "pendiente"

        ingredientes_consumidos: list[schemas.ConsumoInsumoTimelineItem] = []
        desperdicios: list[schemas.DesperdicioTimelineItem] = []

        for consumo in item.consumos:
            li = consumo.lote_insumo
            ingrediente = li.ingrediente if li else None
            unidad_simbolo = ingrediente.unidad_medida.simbolo if ingrediente and ingrediente.unidad_medida else ""
            if consumo.tipo == TIPO_CONSUMO_REAL:
                ingredientes_consumidos.append(
                    schemas.ConsumoInsumoTimelineItem(
                        ingrediente_nombre=ingrediente.nombre if ingrediente else "",
                        cantidad=consumo.cantidad,
                        unidad_medida=unidad_simbolo,
                        lote_insumo_codigo=li.numero_lote if li else "",
                        proveedor_nombre=li.proveedor.nombre if li and li.proveedor else None,
                    )
                )
            elif consumo.tipo == TIPO_CONSUMO_DESPERDICIO:
                desperdicios.append(
                    schemas.DesperdicioTimelineItem(
                        cantidad=consumo.cantidad,
                        unidad_medida=unidad_simbolo,
                        motivo=consumo.motivo,
                    )
                )

        tiene_desvio = len(desperdicios) > 0
        titulo_tarea = item.tarea.descripcion if item.tarea and item.tarea.descripcion else f"Tarea {item.id}"

        nodo_tarea = schemas.NodoTimelineResponse(
            id=f"tarea_{item.id}",
            orden=i,
            tipo="tarea",
            titulo=titulo_tarea,
            subtitulo=None,
            fecha_hora=item.completado_en,
            estado=estado_tarea,
            tiene_desvio=tiene_desvio,
            detalle=schemas.DetalleNodoTimeline(
                operario_nombre=_nombre(item.completado_por),
                descripcion=item.tarea.descripcion if item.tarea else None,
                ingredientes_consumidos=ingredientes_consumidos,
                desperdicios=desperdicios,
                rendimiento=None,
            ),
        )
        nodos.append(nodo_tarea)

    # 3. Nodo Final (tipo='cierre')
    estado_cierre: schemas.EstadoNodoTimeline = (
        "completado" if lote.estado == ESTADO_TERMINADO else "pendiente"
    )

    rendimiento_cierre = None
    if lote.estado == ESTADO_TERMINADO and lote.cantidad_producida is not None:
        porcentaje = None
        if lote.cantidad_objetivo and lote.cantidad_objetivo > 0:
            porcentaje = (
                (Decimal(lote.cantidad_producida) / Decimal(lote.cantidad_objetivo)) * Decimal("100")
            ).quantize(Decimal("0.01"))
        rendimiento_cierre = schemas.RendimientoTimeline(
            cantidad_objetivo=lote.cantidad_objetivo,
            cantidad_producida=lote.cantidad_producida,
            porcentaje_rendimiento=porcentaje,
        )

    nodo_cierre = schemas.NodoTimelineResponse(
        id="cierre",
        orden=len(checklist_ordenado) + 2,
        tipo="cierre",
        titulo="Cierre y Liberación",
        subtitulo=None,
        fecha_hora=lote.fecha_cierre,
        estado=estado_cierre,
        tiene_desvio=False,
        detalle=schemas.DetalleNodoTimeline(
            operario_nombre=None,
            descripcion=None,
            ingredientes_consumidos=[],
            desperdicios=[],
            rendimiento=rendimiento_cierre,
        ),
    )
    nodos.append(nodo_cierre)

    estado_lote_calc = lote.estado_lote if hasattr(lote, "estado_lote") and lote.estado_lote else lote.estado

    return schemas.LoteTimelineResponse(
        lote_id=lote.id,
        numero_lote=lote.numero_lote,
        estado_lote=estado_lote_calc,
        nodos=nodos,
    )
