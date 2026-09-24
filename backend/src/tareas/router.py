import logging
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.tareas import schemas, services

# Creamos un logger para este módulo específico
logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /tareas
router = APIRouter(prefix="/tareas", tags=["tareas"])


@router.post("/", response_model=schemas.Tarea)
def create_tarea(tarea: schemas.TareaCreate, db: Session = Depends(get_db)):
    return services.crear_tarea(db, tarea)


@router.get("/", response_model=List[schemas.Tarea])
def read_tareas(
    plan_limpieza_id: Optional[int] = None, db: Session = Depends(get_db)
):
    logger.info("Consultando la lista de tareas activas")
    return services.listar_tareas(db, plan_limpieza_id)


@router.get("/{tarea_id}", response_model=schemas.Tarea)
def read_tarea(tarea_id: int, db: Session = Depends(get_db)):
    return services.leer_tarea(db, tarea_id)


@router.put("/{tarea_id}", response_model=schemas.Tarea)
def update_tarea(
    tarea_id: int,
    tarea: schemas.TareaUpdate,
    db: Session = Depends(get_db),
):
    return services.modificar_tarea(db, tarea_id, tarea)


@router.delete("/{tarea_id}", response_model=schemas.Tarea)
def delete_tarea(tarea_id: int, db: Session = Depends(get_db)):
    return services.eliminar_tarea(db, tarea_id)
