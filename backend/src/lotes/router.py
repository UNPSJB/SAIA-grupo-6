from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auth.dependencies import require_operador
from src.database import get_db
from src.lotes import schemas
from src.lotes.models import LoteProduccion

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
