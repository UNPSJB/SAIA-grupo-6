from datetime import date, datetime, time, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.insumos.models import TIPO_INSUMO, TIPO_PRODUCTO, Insumo
from src.lotes import schemas
from src.lotes.models import (
    ESTADOS_LOTE,
    ESTADOS_LOTE_CERRADOS,
    InsumoLote,
    LoteProduccion,
)
from src.unidadMedida.models import UnidadMedida

router = APIRouter(prefix="/lotes", tags=["Lotes de Producción"])


def _opciones_insumos():
    return (
        selectinload(LoteProduccion.insumos)
        .selectinload(InsumoLote.insumo)
        .selectinload(Insumo.unidad_medida)
    )


def _aplicar_filtros(
    consulta,
    producto: str | None,
    fecha_desde: date | None,
    fecha_hasta: date | None,
):
    if producto and producto.strip():
        consulta = consulta.where(
            func.lower(LoteProduccion.producto_nombre) == producto.strip().lower()
        )
    if fecha_desde is not None:
        consulta = consulta.where(
            LoteProduccion.fecha_inicio >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        consulta = consulta.where(
            LoteProduccion.fecha_inicio
            < datetime.combine(fecha_hasta + timedelta(days=1), time.min)
        )
    return consulta


def _validar_rango(fecha_desde: date | None, fecha_hasta: date | None) -> None:
    if fecha_desde is not None and fecha_hasta is not None and fecha_desde > fecha_hasta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha desde no puede ser posterior a la fecha hasta.",
        )


def _obtener_lote(db: Session, lote_id: int) -> LoteProduccion:
    lote = db.scalar(
        select(LoteProduccion)
        .where(LoteProduccion.id == lote_id)
        .options(_opciones_insumos())
    )
    if lote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado.",
        )
    return lote


def _validar_lote_modificable(lote: LoteProduccion) -> None:
    if lote.estado in ESTADOS_LOTE_CERRADOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden asociar insumos a un lote finalizado o cancelado.",
        )


def _generar_codigo_lote(db: Session) -> str:
    for _ in range(10):
        codigo = f"L-{datetime.now():%Y%m%d}-{uuid4().hex[:6].upper()}"
        if db.scalar(
            select(LoteProduccion.id).where(LoteProduccion.codigo_lote == codigo)
        ) is None:
            return codigo
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo generar un código de lote único.",
    )


def _unidad_medida_por_defecto(db: Session) -> UnidadMedida:
    unidad = db.scalar(
        select(UnidadMedida).where(UnidadMedida.simbolo == "u")
    )
    if unidad is None:
        unidad = db.scalar(
            select(UnidadMedida).where(UnidadMedida.nombre == "unidad")
        )
    if unidad is None:
        unidad = UnidadMedida(nombre="unidad", simbolo="u")
        db.add(unidad)
        db.flush()
    return unidad


def _crear_producto(db: Session, nombre: str) -> Insumo:
    producto = Insumo(
        nombre=nombre,
        tipo=TIPO_PRODUCTO,
        unidad_medida=_unidad_medida_por_defecto(db),
    )
    db.add(producto)
    db.flush()
    return producto


def _resolver_producto(
    db: Session,
    producto_id: int | None,
    producto_nombre: str | None,
) -> Insumo:
    if producto_id is not None:
        producto = db.get(Insumo, producto_id)
        if producto is None or producto.tipo != TIPO_PRODUCTO:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado.",
            )
        return producto

    nombre = (producto_nombre or "").strip()
    producto = db.scalar(
        select(Insumo).where(
            Insumo.tipo == TIPO_PRODUCTO,
            func.lower(Insumo.nombre) == nombre.lower(),
        )
    )
    if producto is None:
        existente = db.scalar(
            select(Insumo).where(func.lower(Insumo.nombre) == nombre.lower())
        )
        if existente is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Ya existe un insumo con ese nombre. "
                    "Elige otro nombre para el producto."
                ),
            )
        producto = _crear_producto(db, nombre)
    return producto


@router.get(
    "/productos",
    response_model=list[schemas.ProductoResponse],
    dependencies=[Depends(require_operador)],
)
def listar_productos(db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Insumo)
            .where(Insumo.tipo == TIPO_PRODUCTO, Insumo.activo.is_(True))
            .order_by(Insumo.nombre)
        ).all()
    )


@router.get(
    "/insumos-disponibles",
    response_model=list[schemas.InsumoResumen],
    dependencies=[Depends(require_operador)],
)
def listar_insumos_disponibles(db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Insumo)
            .where(Insumo.tipo == TIPO_INSUMO, Insumo.activo.is_(True))
            .options(selectinload(Insumo.unidad_medida))
            .order_by(Insumo.nombre)
        ).all()
    )


@router.get(
    "",
    response_model=list[schemas.LoteResponse],
    dependencies=[Depends(require_admin)],
)
def listar_lotes(
    producto: str | None = Query(default=None, max_length=120),
    fecha_desde: date | None = Query(default=None),
    fecha_hasta: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _validar_rango(fecha_desde, fecha_hasta)
    consulta = select(LoteProduccion).options(_opciones_insumos())
    consulta = _aplicar_filtros(consulta, producto, fecha_desde, fecha_hasta)
    return list(
        db.scalars(
            consulta.order_by(
                LoteProduccion.fecha_inicio.desc(),
                LoteProduccion.id.desc(),
            )
        ).all()
    )


@router.get(
    "/dashboard",
    response_model=schemas.DashboardLotesResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_dashboard(
    producto: str | None = Query(default=None, max_length=120),
    fecha_desde: date | None = Query(default=None),
    fecha_hasta: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    _validar_rango(fecha_desde, fecha_hasta)
    filtros = _aplicar_filtros(
        select(LoteProduccion), producto, fecha_desde, fecha_hasta
    )
    subconsulta = filtros.subquery()

    total_lotes, total_planificada, total_producida = db.execute(
        select(
            func.count(subconsulta.c.id),
            func.coalesce(func.sum(subconsulta.c.cantidad_planificada), 0),
            func.coalesce(func.sum(subconsulta.c.cantidad_producida), 0),
        )
    ).one()

    conteos = {estado: 0 for estado in ESTADOS_LOTE}
    for estado, cantidad in db.execute(
        select(subconsulta.c.estado, func.count(subconsulta.c.id)).group_by(
            subconsulta.c.estado
        )
    ).all():
        if estado in conteos:
            conteos[estado] = cantidad

    por_producto = [
        schemas.ProduccionPorProducto(
            producto=nombre,
            cantidad_producida=cantidad_producida,
            cantidad_lotes=cantidad_lotes,
        )
        for nombre, cantidad_producida, cantidad_lotes in db.execute(
            select(
                subconsulta.c.producto_nombre,
                func.coalesce(func.sum(subconsulta.c.cantidad_producida), 0),
                func.count(subconsulta.c.id),
            )
            .group_by(subconsulta.c.producto_nombre)
            .order_by(func.sum(subconsulta.c.cantidad_producida).desc())
        ).all()
    ]

    porcentaje = (
        round(total_producida / total_planificada * 100, 2)
        if total_planificada
        else 0.0
    )

    return schemas.DashboardLotesResponse(
        total_lotes=total_lotes,
        total_cantidad_planificada=total_planificada,
        total_cantidad_producida=total_producida,
        porcentaje_cumplimiento=porcentaje,
        por_estado=[
            schemas.LoteResumenEstado(estado=estado, cantidad=conteos[estado])
            for estado in ESTADOS_LOTE
        ],
        por_producto=por_producto,
    )


@router.get(
    "/{lote_id}",
    response_model=schemas.LoteResponse,
    dependencies=[Depends(require_operador)],
)
def obtener_lote(lote_id: int, db: Session = Depends(get_db)):
    return _obtener_lote(db, lote_id)


@router.post(
    "",
    response_model=schemas.LoteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_operador)],
)
def crear_lote(datos: schemas.LoteCreate, db: Session = Depends(get_db)):
    producto = _resolver_producto(db, datos.producto_id, datos.producto_nombre)
    codigo_lote = datos.codigo_lote or _generar_codigo_lote(db)

    existente = db.scalar(
        select(LoteProduccion).where(LoteProduccion.codigo_lote == codigo_lote)
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe.",
        )

    valores = {
        "codigo_lote": codigo_lote,
        "producto_id": producto.id,
        "producto_nombre": producto.nombre,
        "cantidad_planificada": datos.cantidad_planificada,
        "cantidad_producida": datos.cantidad_producida or 0,
    }
    if datos.fecha_inicio is not None:
        valores["fecha_inicio"] = datos.fecha_inicio

    lote = LoteProduccion(**valores)
    db.add(lote)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe.",
        )
    db.refresh(lote)
    return lote


@router.get(
    "/{lote_id}/insumos",
    response_model=list[schemas.InsumoLoteResponse],
    dependencies=[Depends(require_operador)],
)
def listar_insumos_del_lote(lote_id: int, db: Session = Depends(get_db)):
    lote = _obtener_lote(db, lote_id)
    return lote.insumos


@router.post(
    "/{lote_id}/insumos/bulk",
    response_model=list[schemas.InsumoLoteResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_operador)],
)
def registrar_insumos_del_lote(
    lote_id: int,
    datos: schemas.InsumosLoteCreate,
    db: Session = Depends(get_db),
):
    lote = _obtener_lote(db, lote_id)
    _validar_lote_modificable(lote)
    ids = [insumo.insumo_id for insumo in datos.insumos]

    insumos = {
        insumo.id: insumo
        for insumo in db.scalars(
            select(Insumo).where(
                Insumo.id.in_(ids),
                Insumo.tipo == TIPO_INSUMO,
            )
        ).all()
    }
    faltantes = [insumo_id for insumo_id in ids if insumo_id not in insumos]
    if faltantes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insumo no encontrado: {faltantes[0]}.",
        )

    ya_registrados = set(
        db.scalars(
            select(InsumoLote.insumo_id).where(
                InsumoLote.lote_id == lote_id,
                InsumoLote.insumo_id.in_(ids),
            )
        ).all()
    )
    if ya_registrados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más insumos ya están registrados en el lote.",
        )

    registros = [
        InsumoLote(
            lote=lote,
            insumo=insumos[insumo.insumo_id],
            cantidad=insumo.cantidad,
        )
        for insumo in datos.insumos
    ]
    db.add_all(registros)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más insumos ya están registrados en el lote.",
        )
    return registros


@router.post(
    "/{lote_id}/insumos",
    response_model=schemas.InsumoLoteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_operador)],
)
def registrar_insumo_del_lote(
    lote_id: int,
    datos: schemas.InsumoLoteCreate,
    db: Session = Depends(get_db),
):
    lote = _obtener_lote(db, lote_id)
    _validar_lote_modificable(lote)

    insumo = db.get(Insumo, datos.insumo_id)
    if insumo is None or insumo.tipo != TIPO_INSUMO:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado.",
        )

    existente = db.scalar(
        select(InsumoLote).where(
            InsumoLote.lote_id == lote_id,
            InsumoLote.insumo_id == datos.insumo_id,
        )
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El insumo ya está registrado en el lote.",
        )

    registro = InsumoLote(lote=lote, insumo=insumo, cantidad=datos.cantidad)
    db.add(registro)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El insumo ya está registrado en el lote.",
        )
    db.refresh(registro)
    return registro
