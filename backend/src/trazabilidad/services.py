from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.lotes import services as lotes_services
from src.lotes.constants import TIPO_CONSUMO_DESPERDICIO, TIPO_CONSUMO_REAL
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.lotesInsumo import services as lotes_insumo_services
from src.lotesInsumo.models import LoteInsumo
from src.personal.models import Personal
from src.trazabilidad import schemas

_MILESIMA = Decimal("0.001")
CERO = Decimal("0.000")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_MILESIMA)


def _usuario(db: Session, usuario_id: int | None) -> schemas.UsuarioResumen | None:
    if usuario_id is None:
        return None
    persona = db.get(Personal, usuario_id)
    if persona is None:
        return None
    nombre = f"{persona.nombre} {persona.apellido or ''}".strip()
    return schemas.UsuarioResumen(id=persona.id, nombre=nombre)


def _lote_insumo_traza(lote: LoteInsumo) -> schemas.LoteInsumoTraza:
    return schemas.LoteInsumoTraza(
        id=lote.id,
        insumo_id=lote.insumo_id,
        insumo_nombre=lote.insumo.nombre,
        numero_lote=lote.numero_lote,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_vencimiento=lote.fecha_vencimiento,
        activo=lote.activo,
        proveedor=schemas.ProveedorTraza(
            id=lote.proveedor.id,
            nombre=lote.proveedor.nombre,
            matricula=lote.proveedor.matricula,
        ),
    )


def trazar_lote_producto(db: Session, lote_id: int) -> schemas.TrazabilidadLoteProducto:
    """Hacia atrás: receta y versión, quién lo elaboró, tareas, consumos, lotes de insumo y proveedores."""
    lote = lotes_services.obtener_lote(db, lote_id)
    detalle = lotes_services.detalle(db, lote)
    planificado_por_item = {item.id: item.insumos for item in detalle.checklist}

    receta = None
    version = lote.version_receta
    if version is not None:
        receta = schemas.RecetaTraza(
            receta_id=version.receta_id,
            version_id=version.id,
            version_numero=version.numero,
            rendimiento=version.rendimiento,
            unidad=version.unidad_medida.simbolo,
            creada_en=version.creado_en,
            creada_por=_usuario(db, version.creado_por_id),
        )

    tareas = []
    lotes_insumo: dict[int, schemas.LoteInsumoTraza] = {}
    for item in sorted(lote.checklist, key=lambda i: i.tarea.orden):
        consumos = []
        for consumo in item.consumos:
            traza = _lote_insumo_traza(consumo.lote_insumo)
            lotes_insumo.setdefault(traza.id, traza)
            consumos.append(
                schemas.ConsumoTraza(
                    id=consumo.id,
                    tipo=consumo.tipo,
                    cantidad=_q(consumo.cantidad),
                    unidad=consumo.lote_insumo.insumo.unidad_medida.simbolo,
                    motivo=consumo.motivo,
                    registrado_por=_usuario(db, consumo.registrado_por_id),
                    registrado_en=consumo.registrado_en,
                    lote_insumo=traza,
                )
            )
        tareas.append(
            schemas.TareaTraza(
                item_id=item.id,
                orden=item.tarea.orden,
                descripcion=item.tarea.descripcion,
                completado_por=_usuario(db, item.completado_por_id),
                completado_en=item.completado_en,
                planificado=planificado_por_item[item.id],
                consumos=consumos,
            )
        )

    proveedores: dict[int, schemas.ProveedorTraza] = {}
    for traza in lotes_insumo.values():
        proveedores.setdefault(traza.proveedor.id, traza.proveedor)

    return schemas.TrazabilidadLoteProducto(
        lote=lotes_services.resumen(lote),
        elaborado_por=_usuario(db, lote.creado_por_id),
        receta=receta,
        tareas=tareas,
        lotes_insumo=list(lotes_insumo.values()),
        proveedores=list(proveedores.values()),
    )


def trazar_lote_insumo(db: Session, lote_insumo_id: int) -> schemas.TrazabilidadLoteInsumo:
    """Hacia adelante: lotes de producto (de cualquier estado) que consumieron ese lote de insumo."""
    lote_insumo = lotes_insumo_services.obtener_lote_insumo(db, lote_insumo_id)

    filas = db.execute(
        select(LoteProducto, ConsumoInsumo.tipo, ConsumoInsumo.cantidad)
        .join(ChecklistProduccion, ChecklistProduccion.lote_producto_id == LoteProducto.id)
        .join(ConsumoInsumo, ConsumoInsumo.checklist_produccion_id == ChecklistProduccion.id)
        .where(ConsumoInsumo.lote_insumo_id == lote_insumo_id)
        .options(selectinload(LoteProducto.producto))
        .order_by(LoteProducto.fecha_inicio, LoteProducto.id)
    ).all()

    acumulado: dict[int, dict] = {}
    totales = defaultdict(lambda: {TIPO_CONSUMO_REAL: CERO, TIPO_CONSUMO_DESPERDICIO: CERO})
    for lote, tipo, cantidad in filas:
        acumulado.setdefault(lote.id, lote)
        totales[lote.id][tipo] += _q(cantidad)

    lotes_producto = [
        schemas.LoteProductoUsoInsumo(
            lote_producto_id=lote.id,
            numero_lote=lote.numero_lote,
            producto_id=lote.producto_id,
            producto_nombre=lote.producto.nombre,
            estado=lote.estado,
            fecha_inicio=lote.fecha_inicio,
            consumo_real=totales[lote.id][TIPO_CONSUMO_REAL],
            desperdicio=totales[lote.id][TIPO_CONSUMO_DESPERDICIO],
        )
        for lote in acumulado.values()
    ]
    return schemas.TrazabilidadLoteInsumo(
        lote_insumo=_lote_insumo_traza(lote_insumo),
        cantidad_recibida=_q(lote_insumo.cantidad_recibida),
        saldo=lotes_insumo_services.saldo_lote_insumo(db, lote_insumo),
        lotes_producto=lotes_producto,
    )
