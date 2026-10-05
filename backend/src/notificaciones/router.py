from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import require_admin
from src.notificaciones import schemas, services

# Las alertas de recambio y vencimientos son parte de las historias de
# administración ("Como: persona con permiso de administrar").
router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"],
    dependencies=[Depends(require_admin)],
)

@router.get("", response_model=List[schemas.NotificacionResponse])
def listar_notificaciones(db: Session = Depends(get_db)):
    return services.obtener_todas_notificaciones(db)