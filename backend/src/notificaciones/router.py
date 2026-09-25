from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.notificaciones import schemas, services

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])

@router.get("", response_model=List[schemas.NotificacionResponse])
def listar_notificaciones(db: Session = Depends(get_db)):
    return services.obtener_todas_notificaciones(db)