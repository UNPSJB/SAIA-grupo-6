from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora, hoy
from src.insumos.models import Insumo
from src.lotes.constants import TIPO_CONSUMO_DESPERDICIO, TIPO_CONSUMO_REAL
from src.lotes.models import ConsumoInsumo
from src.lotesInsumo import exceptions, schemas
from src.lotesInsumo.constants import ETIQUETAS_MOTIVO_BAJA, MOTIVOS_BAJA_INSUMO
from src.lotesInsumo.models import BajaLoteInsumo, LoteInsumo
from src.personal.models import Personal
from src.proveedores.models import Proveedor
from src.proveedores.services import obtener_certificacion_vigente

_MILESIMA = Decimal("0.001")
CERO = Decimal("0.000")


def _q(valor) -> Decimal:
    return Decimal(valor or 0).quantize(_MILESIMA)


def _nombre_personal(persona: Personal | None) -> str | None:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def obtener_lote_insumo(db: Session, lote_insumo_id: int) -> LoteInsumo:
    lote = db.scalar(
        select(LoteInsumo)
        .where(LoteInsumo.id == lote_insumo_id)
        .options(
            selectinload(LoteInsumo.insumo).selectinload(Insumo.unidad_medida),
            selectinload(LoteInsumo.proveedor),
            selectinload(LoteInsumo.dado_de_baja_por),
        )
    )
    if lote is None:
        raise exceptions.LoteInsumoNoEncontrado()
    return lote


def lote_a_respuesta(lote: LoteInsumo) -> schemas.LoteInsumoResponse:
    return schemas.LoteInsumoResponse(
        id=lote.id,
        insumo=schemas.InsumoResumen(id=lote.insumo.id, nombre=lote.insumo.nombre),
        proveedor=schemas.ProveedorResumen(
            id=lote.proveedor.id,
            nombre=lote.proveedor.nombre,
            matricula=lote.proveedor.matricula,
        ),
        numero_lote=lote.numero_lote,
        cantidad_recibida=lote.cantidad_recibida,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_vencimiento=lote.fecha_vencimiento,
        activo=lote.activo,
        motivo_baja=lote.motivo_baja,
        fecha_baja=lote.fecha_baja,
        dado_de_baja_por_nombre=_nombre_personal(lote.dado_de_baja_por),
        certificacion_id=lote.certificacion_id,
    )


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

    certificacion = obtener_certificacion_vigente(db, proveedor.id, fecha_ingreso)
    if proveedor.es_certificado and certificacion is None:
        raise exceptions.CertificacionProveedorNoVigente()

    lote = LoteInsumo(
        insumo=insumo,
        proveedor=proveedor,
        numero_lote=datos.numero_lote,
        cantidad_recibida=datos.cantidad_recibida,
        fecha_ingreso=fecha_ingreso,
        fecha_vencimiento=datos.fecha_vencimiento,
        creado_por_id=usuario.id if usuario else None,
        certificacion_id=certificacion.id if certificacion else None,
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


def dar_de_baja_lote_insumo(
    db: Session,
    lote_insumo_id: int,
    datos: schemas.LoteInsumoBaja,
    usuario: Personal,
) -> LoteInsumo:
    """Registra una baja por motivo (parcial o total) con auditoría de usuario, fecha y foto opcional.

    - Descuenta del saldo disponible del lote.
    - Si se da de baja la totalidad del saldo (o se solicita baja total), marca `activo=False`,
      impidiendo que el lote vuelva a asociarse a lotes de producción.
    """
    lote = obtener_lote_insumo(db, lote_insumo_id)
    if not lote.activo:
        raise exceptions.LoteYaDadoDeBaja()

    saldo_actual = saldo_lote_insumo(db, lote)
    cantidad_baja = _q(datos.cantidad) if datos.cantidad is not None else saldo_actual

    if cantidad_baja <= CERO:
        raise exceptions.CantidadBajaInvalida()
    if cantidad_baja > saldo_actual:
        raise exceptions.CantidadSuperaSaldo()

    momento = ahora()
    registro = BajaLoteInsumo(
        lote_insumo_id=lote.id,
        motivo=datos.motivo,
        observaciones=datos.observaciones,
        cantidad=cantidad_baja,
        foto_data_url=datos.foto_data_url,
        registrado_por_id=usuario.id,
        registrado_en=momento,
    )
    db.add(registro)

    # Si se agota el saldo o se indicó dar de baja el lote completo, queda inactivo.
    if datos.dar_de_baja_lote_completo or cantidad_baja >= saldo_actual:
        lote.activo = False
        lote.motivo_baja = datos.motivo
        lote.fecha_baja = momento
        lote.dado_de_baja_por_id = usuario.id

    db.commit()
    return obtener_lote_insumo(db, lote_insumo_id)


def listar_bajas_lote_insumo(
    db: Session, lote_insumo_id: int
) -> list[schemas.BajaLoteInsumoResponse]:
    obtener_lote_insumo(db, lote_insumo_id)
    filas = db.scalars(
        select(BajaLoteInsumo)
        .where(BajaLoteInsumo.lote_insumo_id == lote_insumo_id)
        .options(selectinload(BajaLoteInsumo.registrado_por))
        .order_by(BajaLoteInsumo.registrado_en.desc(), BajaLoteInsumo.id.desc())
    ).all()
    return [
        schemas.BajaLoteInsumoResponse(
            id=b.id,
            lote_insumo_id=b.lote_insumo_id,
            motivo=b.motivo,
            motivo_etiqueta=ETIQUETAS_MOTIVO_BAJA.get(b.motivo, b.motivo),
            observaciones=b.observaciones,
            cantidad=_q(b.cantidad),
            tiene_foto=bool(b.foto_data_url),
            foto_data_url=b.foto_data_url,
            registrado_por_id=b.registrado_por_id,
            registrado_por_nombre=_nombre_personal(b.registrado_por) or "—",
            registrado_en=b.registrado_en,
        )
        for b in filas
    ]


def listar_lotes_insumo(
    db: Session,
    insumo_id: int | None = None,
    proveedor_id: int | None = None,
    incluir_inactivos: bool = False,
) -> list[LoteInsumo]:
    consulta = select(LoteInsumo).options(
        selectinload(LoteInsumo.insumo),
        selectinload(LoteInsumo.proveedor),
        selectinload(LoteInsumo.dado_de_baja_por),
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


def _bajas_por_lote(
    db: Session, lote_ids: list[int] | None = None
) -> dict[int, Decimal]:
    consulta = select(
        BajaLoteInsumo.lote_insumo_id,
        func.sum(BajaLoteInsumo.cantidad),
    ).group_by(BajaLoteInsumo.lote_insumo_id)
    if lote_ids is not None:
        consulta = consulta.where(BajaLoteInsumo.lote_insumo_id.in_(lote_ids))

    acumulado: dict[int, Decimal] = defaultdict(lambda: CERO)
    for lote_id, total in db.execute(consulta).all():
        acumulado[lote_id] = _q(total)
    return acumulado


def saldo_lote_insumo(db: Session, lote: LoteInsumo) -> Decimal:
    """Recibido - (consumo real + desperdicio + bajas registradas)."""
    consumos = _consumos_por_lote(db, [lote.id])[lote.id]
    bajas = _bajas_por_lote(db, [lote.id])[lote.id]
    return (
        _q(lote.cantidad_recibida)
        - consumos[TIPO_CONSUMO_REAL]
        - consumos[TIPO_CONSUMO_DESPERDICIO]
        - bajas
    )


def stock_por_lote(
    db: Session,
    insumo_id: int | None = None,
    incluir_inactivos: bool = False,
) -> list[schemas.StockLoteInsumo]:
    """Stock de cada lote de insumo, ordenado por vencimiento (FEFO)."""
    consulta = select(LoteInsumo).options(
        selectinload(LoteInsumo.insumo).selectinload(Insumo.unidad_medida),
        selectinload(LoteInsumo.proveedor),
        selectinload(LoteInsumo.dado_de_baja_por),
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
    lote_ids = [lote.id for lote in lotes]
    consumos = _consumos_por_lote(db, lote_ids)
    bajas = _bajas_por_lote(db, lote_ids)
    hoy_ = hoy()
    resultado = []
    for lote in lotes:
        real = consumos[lote.id][TIPO_CONSUMO_REAL] if lote.id in consumos else CERO
        desperdicio = (
            consumos[lote.id][TIPO_CONSUMO_DESPERDICIO] if lote.id in consumos else CERO
        )
        cantidad_baja = bajas[lote.id] if lote.id in bajas else CERO
        resultado.append(
            schemas.StockLoteInsumo(
                lote_insumo_id=lote.id,
                insumo_id=lote.insumo_id,
                insumo_nombre=lote.insumo.nombre,
                unidad=lote.insumo.unidad_medida.simbolo,
                proveedor_id=lote.proveedor_id,
                proveedor_nombre=lote.proveedor.nombre,
                numero_lote=lote.numero_lote,
                fecha_vencimiento=lote.fecha_vencimiento,
                activo=lote.activo,
                vencido=_vencido(lote.fecha_vencimiento, hoy_),
                motivo_baja=ETIQUETAS_MOTIVO_BAJA.get(lote.motivo_baja, lote.motivo_baja)
                if lote.motivo_baja
                else None,
                fecha_baja=lote.fecha_baja,
                dado_de_baja_por_nombre=_nombre_personal(lote.dado_de_baja_por),
                cantidad_recibida=_q(lote.cantidad_recibida),
                consumo_real=real,
                desperdicio=desperdicio,
                cantidad_baja=cantidad_baja,
                saldo=_q(lote.cantidad_recibida) - real - desperdicio - cantidad_baja,
            )
        )
    return resultado


def _vencido(fecha_vencimiento: date | None, referencia: date) -> bool:
    return fecha_vencimiento is not None and fecha_vencimiento < referencia


def lotes_sugeridos(
    db: Session, insumo_id: int, todos: bool = False
) -> list[schemas.StockLoteInsumo]:
    """Solo devuelve lotes activos (`activo=True`), por lo que un lote dado de baja nunca aparece."""
    lotes = stock_por_lote(db, insumo_id=insumo_id, incluir_inactivos=False)
    if todos:
        return lotes
    return [lote for lote in lotes if lote.saldo > 0 and not lote.vencido]


def stock_por_insumo(
    db: Session, insumo_id: int | None = None
) -> list[schemas.StockInsumo]:
    consulta = select(Insumo).where(Insumo.activo.is_(True))
    if insumo_id is not None:
        consulta = consulta.where(Insumo.id == insumo_id)
    insumos = list(
        db.scalars(
            consulta.options(selectinload(Insumo.unidad_medida)).order_by(Insumo.nombre)
        ).all()
    )

    por_insumo: dict[int, list[schemas.StockLoteInsumo]] = defaultdict(list)
    for lote in stock_por_lote(db, insumo_id=insumo_id, incluir_inactivos=False):
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
                cantidad_baja=sum((l.cantidad_baja for l in lotes), CERO),
                stock=sum((l.saldo for l in lotes), CERO),
                stock_vencido=sum((l.saldo for l in lotes if l.vencido), CERO),
            )
        )
    return resultado


def indicador_bajas_por_motivo(
    db: Session,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
) -> schemas.IndicadorBajasResponse:
    """Indicador para el tablero: cantidad de registros y volumen dado de baja por motivo."""
    consulta = select(
        BajaLoteInsumo.motivo,
        func.count(BajaLoteInsumo.id),
        func.sum(BajaLoteInsumo.cantidad),
    ).group_by(BajaLoteInsumo.motivo)

    if fecha_desde is not None:
        consulta = consulta.where(
            BajaLoteInsumo.registrado_en >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        consulta = consulta.where(
            BajaLoteInsumo.registrado_en
            < datetime.combine(fecha_hasta + timedelta(days=1), time.min)
        )

    filas_db = {
        motivo: (int(cant), _q(total))
        for motivo, cant, total in db.execute(consulta).all()
    }

    items: list[schemas.IndicadorBajasPorMotivoItem] = []
    total_registros = 0
    for motivo in MOTIVOS_BAJA_INSUMO:
        cant, total = filas_db.get(motivo, (0, CERO))
        total_registros += cant
        items.append(
            schemas.IndicadorBajasPorMotivoItem(
                motivo=motivo,
                etiqueta=ETIQUETAS_MOTIVO_BAJA[motivo],
                cantidad_registros=cant,
                cantidad_total=total,
            )
        )

    return schemas.IndicadorBajasResponse(
        total_registros=total_registros,
        por_motivo=items,
    )