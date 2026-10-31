from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.auth.dependencies import require_operador
from src.database import get_db
from src.insumos.models import Insumo
from src.lotes import schemas
from src.lotes.models import ESTADOS_LOTE, InsumoLote, LoteProduccion

router = APIRouter(
    prefix="/lotes",
    tags=["Lotes de Producción"],
    dependencies=[Depends(require_operador)],
)


@router.get("", response_model=list[schemas.LoteResponse])
def listar_lotes(db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(LoteProduccion).order_by(
                LoteProduccion.fecha_inicio.desc(),
                LoteProduccion.id.desc(),
            )
        ).all()
    )


@router.get("/dashboard", response_model=schemas.DashboardLotesResponse)
def obtener_dashboard(db: Session = Depends(get_db)):
    total_lotes, total_planificada, total_producida = db.execute(
        select(
            func.count(LoteProduccion.id),
            func.coalesce(func.sum(LoteProduccion.cantidad_planificada), 0),
            func.coalesce(func.sum(LoteProduccion.cantidad_producida), 0),
        )
    ).one()

    conteos = {estado: 0 for estado in ESTADOS_LOTE}
    for estado, cantidad in db.execute(
        select(LoteProduccion.estado, func.count(LoteProduccion.id)).group_by(
            LoteProduccion.estado
        )
    ).all():
        if estado in conteos:
            conteos[estado] = cantidad

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
    )


@router.post(
    "",
    response_model=schemas.LoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_lote(datos: schemas.LoteCreate, db: Session = Depends(get_db)):
    existente = db.scalar(
        select(LoteProduccion).where(LoteProduccion.codigo_lote == datos.codigo_lote)
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de lote ya existe.",
        )

    lote = LoteProduccion(**datos.model_dump())
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
)
def listar_insumos_del_lote(lote_id: int, db: Session = Depends(get_db)):
    lote = db.get(LoteProduccion, lote_id)
    if lote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado.",
        )

    return list(
        db.scalars(
            select(InsumoLote)
            .where(InsumoLote.lote_id == lote_id)
            .options(
                selectinload(InsumoLote.insumo).selectinload(Insumo.unidad_medida)
            )
            .order_by(InsumoLote.id)
        ).all()
    )


@router.post(
    "/{lote_id}/insumos",
    response_model=schemas.InsumoLoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_insumo_del_lote(
    lote_id: int,
    datos: schemas.InsumoLoteCreate,
    db: Session = Depends(get_db),
):
    lote = db.get(LoteProduccion, lote_id)
    if lote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado.",
        )

    insumo = db.get(Insumo, datos.insumo_id)
    if insumo is None:
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
