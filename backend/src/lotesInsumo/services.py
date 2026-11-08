from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora, hoy
from src.insumos.models import Insumo
from src.lotes.constants import TIPO_CONSUMO_DESPERDICIO, TIPO_CONSUMO_REAL
from src.lotes.models import ConsumoInsumo
from src.lotesInsumo import exceptions, schemas
from src.lotesInsumo.models import LoteInsumo
from src.personal.models import Personal
from src.proveedores.models import Proveedor

_MILESIMA = Decimal("0.001")
CERO = Decimal("0.000")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_MILESIMA)


def obtener_lote_insumo(db: Session, lote_insumo_id: int) -> LoteInsumo:
    lote = db.scalar(
        select(LoteInsumo)
        .where(LoteInsumo.id == lote_insumo_id)
        .options(selectinload(LoteInsumo.insumo), selectinload(LoteInsumo.proveedor))
    )
    if lote is None:
        raise exceptions.LoteInsumoNoEncontrado()
    return lote


def crear_lote_insumo(
    db: Session, datos: schemas.LoteInsumoCreate, usuario: Personal | None = None
) -> LoteInsumo:
    insumo = db.get(Insumo, datos.insumo_id)
    if insumo is None or not insumo.activo:
        raise exceptions.InsumoNoEncontrado()
    proveedor = db.get(Proveedor, datos.proveedor_id)
    if proveedor is None or not proveedor.activo:
        raise exceptions.ProveedorNoEncontrado()

    fecha_ingreso = datos.fecha_ingreso or hoy()
    if datos.fecha_vencimiento is not None and datos.fecha_vencimiento < fecha_ingreso:
        raise exceptions.VencimientoAnterior()

    lote = LoteInsumo(
        insumo=insumo,
        proveedor=proveedor,
        numero_lote=datos.numero_lote,
        cantidad_recibida=datos.cantidad_recibida,
        fecha_ingreso=fecha_ingreso,
        fecha_vencimiento=datos.fecha_vencimiento,
        creado_por_id=usuario.id if usuario else None,
    )
    db.add(lote)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if "unique" in str(error.orig).lower():
            raise exceptions.LoteInsumoYaExiste() from error
        raise
    return obtener_lote_insumo(db, lote.id)


def dar_de_baja_lote_insumo(db: Session, lote_insumo_id: int, motivo: str) -> LoteInsumo:
    """Baja lógica (vencimiento, descarte). El historial de consumos se conserva."""
    lote = obtener_lote_insumo(db, lote_insumo_id)
    if not lote.activo:
        raise exceptions.LoteYaDadoDeBaja()
    lote.activo = False
    lote.motivo_baja = motivo
    lote.fecha_baja = ahora()
    db.commit()
    return obtener_lote_insumo(db, lote_insumo_id)


def listar_lotes_insumo(
    db: Session,
    insumo_id: int | None = None,
    proveedor_id: int | None = None,
    incluir_inactivos: bool = False,
) -> list[LoteInsumo]:
    consulta = select(LoteInsumo).options(
        selectinload(LoteInsumo.insumo), selectinload(LoteInsumo.proveedor)
    )
    if insumo_id is not None:
        consulta = consulta.where(LoteInsumo.insumo_id == insumo_id)
    if proveedor_id is not None:
        consulta = consulta.where(LoteInsumo.proveedor_id == proveedor_id)
    if not incluir_inactivos:
        consulta = consulta.where(LoteInsumo.activo.is_(True))
    return list(db.scalars(consulta.order_by(LoteInsumo.id)).all())


def _consumos_por_lote(
    db: Session, lote_ids: list[int] | None = None
) -> dict[int, dict[str, Decimal]]:
    consulta = select(
        ConsumoInsumo.lote_insumo_id,
        ConsumoInsumo.tipo,
        func.sum(ConsumoInsumo.cantidad),
    ).group_by(ConsumoInsumo.lote_insumo_id, ConsumoInsumo.tipo)
    if lote_ids is not None:
        consulta = consulta.where(ConsumoInsumo.lote_insumo_id.in_(lote_ids))

    acumulado: dict[int, dict[str, Decimal]] = defaultdict(
        lambda: {TIPO_CONSUMO_REAL: CERO, TIPO_CONSUMO_DESPERDICIO: CERO}
    )
    for lote_id, tipo, total in db.execute(consulta).all():
        acumulado[lote_id][tipo] = _q(total)
    return acumulado


def saldo_lote_insumo(db: Session, lote: LoteInsumo) -> Decimal:
    """Recibido - (consumo real + desperdicio). Nunca se guarda en una columna."""
    consumos = _consumos_por_lote(db, [lote.id])[lote.id]
    return _q(lote.cantidad_recibida) - consumos[TIPO_CONSUMO_REAL] - consumos[TIPO_CONSUMO_DESPERDICIO]


def stock_por_lote(
    db: Session,
    insumo_id: int | None = None,
    incluir_inactivos: bool = False,
) -> list[schemas.StockLoteInsumo]:
    """Stock de cada lote de insumo, ordenado por vencimiento (FEFO)."""
    consulta = select(LoteInsumo).options(
        selectinload(LoteInsumo.insumo), selectinload(LoteInsumo.proveedor)
    )
    if insumo_id is not None:
        consulta = consulta.where(LoteInsumo.insumo_id == insumo_id)
    if not incluir_inactivos:
        consulta = consulta.where(LoteInsumo.activo.is_(True))
    lotes = list(
        db.scalars(
            consulta.order_by(
                LoteInsumo.fecha_vencimiento.is_(None),
                LoteInsumo.fecha_vencimiento,
                LoteInsumo.fecha_ingreso,
                LoteInsumo.id,
            )
        ).all()
    )
    consumos = _consumos_por_lote(db, [lote.id for lote in lotes])
    hoy_ = hoy()
    resultado = []
    for lote in lotes:
        real = consumos[lote.id][TIPO_CONSUMO_REAL] if lote.id in consumos else CERO
        desperdicio = (
            consumos[lote.id][TIPO_CONSUMO_DESPERDICIO] if lote.id in consumos else CERO
        )
        resultado.append(
            schemas.StockLoteInsumo(
                lote_insumo_id=lote.id,
                insumo_id=lote.insumo_id,
                insumo_nombre=lote.insumo.nombre,
                proveedor_id=lote.proveedor_id,
                proveedor_nombre=lote.proveedor.nombre,
                numero_lote=lote.numero_lote,
                fecha_vencimiento=lote.fecha_vencimiento,
                activo=lote.activo,
                vencido=_vencido(lote.fecha_vencimiento, hoy_),
                cantidad_recibida=_q(lote.cantidad_recibida),
                consumo_real=real,
                desperdicio=desperdicio,
                saldo=_q(lote.cantidad_recibida) - real - desperdicio,
            )
        )
    return resultado


def _vencido(fecha_vencimiento: date | None, referencia: date) -> bool:
    return fecha_vencimiento is not None and fecha_vencimiento < referencia


def lotes_sugeridos(
    db: Session, insumo_id: int, todos: bool = False
) -> list[schemas.StockLoteInsumo]:
    """Lotes para consumir, primero el que vence antes (FEFO).

    Por defecto solo los disponibles (con saldo y sin vencer). Con `todos` se
    devuelven todos los lotes activos en el mismo orden, para que el operador
    pueda elegir otro distinto del sugerido.
    """
    lotes = stock_por_lote(db, insumo_id=insumo_id)
    if todos:
        return lotes
    return [lote for lote in lotes if lote.saldo > 0 and not lote.vencido]


def stock_por_insumo(
    db: Session, insumo_id: int | None = None
) -> list[schemas.StockInsumo]:
    """Stock actual por insumo, sumando solo los lotes activos.

    Un lote dado de baja (vencimiento, descarte) deja de contar: su saldo se
    considera descartado. `stock_vencido` es la parte del stock que ya venció.
    """
    consulta = select(Insumo).where(Insumo.activo.is_(True))
    if insumo_id is not None:
        consulta = consulta.where(Insumo.id == insumo_id)
    insumos = list(
        db.scalars(
            consulta.options(selectinload(Insumo.unidad_medida)).order_by(Insumo.nombre)
        ).all()
    )

    por_insumo: dict[int, list[schemas.StockLoteInsumo]] = defaultdict(list)
    for lote in stock_por_lote(db, insumo_id=insumo_id):
        por_insumo[lote.insumo_id].append(lote)

    resultado = []
    for insumo in insumos:
        lotes = por_insumo.get(insumo.id, [])
        resultado.append(
            schemas.StockInsumo(
                insumo_id=insumo.id,
                insumo_nombre=insumo.nombre,
                unidad=insumo.unidad_medida.simbolo,
                cantidad_recibida=sum((l.cantidad_recibida for l in lotes), CERO),
                consumo_real=sum((l.consumo_real for l in lotes), CERO),
                desperdicio=sum((l.desperdicio for l in lotes), CERO),
                stock=sum((l.saldo for l in lotes), CERO),
                stock_vencido=sum((l.saldo for l in lotes if l.vencido), CERO),
            )
        )
    return resultado
