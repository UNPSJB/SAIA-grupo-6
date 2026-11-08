from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.trazabilidad import schemas, services

router = APIRouter(
    prefix="/trazabilidad",
    tags=["Trazabilidad"],
    dependencies=[Depends(require_admin)],
)


@router.get("/lotes-producto/{lote_id}", response_model=schemas.TrazabilidadLoteProducto)
def trazar_lote_producto(lote_id: int, db: Session = Depends(get_db)):
    return services.trazar_lote_producto(db, lote_id)


@router.get(
    "/lotes-insumo/{lote_insumo_id}/lotes-producto",
    response_model=schemas.TrazabilidadLoteInsumo,
)
def trazar_lote_insumo(lote_insumo_id: int, db: Session = Depends(get_db)):
    return services.trazar_lote_insumo(db, lote_insumo_id)
