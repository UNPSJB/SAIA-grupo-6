import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.checklist import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checklist", tags=["checklist"])


@router.get("/tareas-del-dia", response_model=schemas.TareasDelDiaResponse)
def listar_tareas_del_dia(
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Lista plana de las tareas de todos los equipos activos para una fecha,
    con el nombre del plan al que pertenece cada una. Reemplaza el patrón de
    pedir /checklist/hoy una vez por equipo desde el frontend."""
    logger.info(f"Consultando tareas del día para fecha {fecha}")
    return services.listar_tareas_del_dia(db, fecha)


@router.patch("/tarea/{tarea_id}", response_model=schemas.RegistroTareaResponse)
def marcar_tarea(
    tarea_id: int,
    datos: schemas.RegistroTareaUpdate,
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return services.marcar_tarea(db, tarea_id, datos, fecha)