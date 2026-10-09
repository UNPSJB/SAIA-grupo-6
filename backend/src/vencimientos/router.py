from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.vencimientos import schemas, services

# La vista consolidada es de la persona con permiso de administrar.
router = APIRouter(
    prefix="/vencimientos",
    tags=["Vencimientos"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=List[schemas.VencimientoConsolidadoResponse])
def listar_vencimientos(
    tipo: Optional[Literal["PERSONAL", "CALIBRACION", "MANTENIMIENTO"]] = Query(None),
    db: Session = Depends(get_db),
):
    return services.listar_vencimientos(db, tipo)