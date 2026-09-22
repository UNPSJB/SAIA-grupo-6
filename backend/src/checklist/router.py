import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.checklist import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checklist", tags=["checklist"])


@router.get("/hoy", response_model=schemas.ChecklistResponse)
def obtener_checklist_hoy(
    equipo_id: int = Query(..., gt=0),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    logger.info(f"Consultando checklist para equipo {equipo_id} en fecha {fecha}")
    return services.obtener_o_crear_checklist(db, equipo_id, fecha)


@router.patch("/tarea/{tarea_id}", response_model=schemas.RegistroTareaResponse)
def marcar_tarea(
    tarea_id: int,
    datos: schemas.RegistroTareaUpdate,
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return services.marcar_tarea(db, tarea_id, datos, fecha)