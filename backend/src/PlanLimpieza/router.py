import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.PlanLimpieza import schemas, services

# Creamos un logger para este módulo específico
logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /planes-limpieza
router = APIRouter(prefix="/planes-limpieza", tags=["planes de limpieza"])


@router.post("/", response_model=schemas.PlanLimpieza)
def create_plan_limpieza(
    plan: schemas.PlanLimpiezaCreate, db: Session = Depends(get_db)
):
    return services.crear_plan_limpieza(db, plan)


@router.get("/", response_model=List[schemas.PlanLimpieza])
def read_planes_limpieza(db: Session = Depends(get_db)):
    logger.info("Consultando la lista de planes de limpieza activos")
    return services.listar_planes_limpieza(db)


@router.get("/{plan_id}", response_model=schemas.PlanLimpieza)
def read_plan_limpieza(plan_id: int, db: Session = Depends(get_db)):
    return services.leer_plan_limpieza(db, plan_id)


@router.put("/{plan_id}", response_model=schemas.PlanLimpieza)
def update_plan_limpieza(
    plan_id: int,
    plan: schemas.PlanLimpiezaUpdate,
    db: Session = Depends(get_db),
):
    return services.modificar_plan_limpieza(db, plan_id, plan)


@router.delete("/{plan_id}", response_model=schemas.PlanLimpieza)
def delete_plan_limpieza(plan_id: int, db: Session = Depends(get_db)):
    return services.eliminar_plan_limpieza(db, plan_id)