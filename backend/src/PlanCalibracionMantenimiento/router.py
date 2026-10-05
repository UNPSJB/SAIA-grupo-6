from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.PlanCalibracionMantenimiento import schemas, services
from src.auth.dependencies import require_admin
from src.personal.models import Personal


router = APIRouter(
    prefix="/planes-calibracion-mantenimiento",
    tags=["planes de calibración y mantenimiento"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.PlanCalibracionMantenimiento)
def create_plan_calibracion_mantenimiento(
    plan: schemas.PlanCalibracionMantenimientoCreate,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(require_admin),
):
    return services.crear_plan_calibracion_mantenimiento(db, plan, current_user.id)


@router.get("", response_model=list[schemas.PlanCalibracionMantenimiento])
def read_planes_calibracion_mantenimiento(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    return services.listar_planes_calibracion_mantenimiento(db, incluir_inactivos)


@router.get("/{plan_id}", response_model=schemas.PlanCalibracionMantenimiento)
def read_plan_calibracion_mantenimiento(
    plan_id: int,
    db: Session = Depends(get_db),
):
    return services.leer_plan_calibracion_mantenimiento(db, plan_id)


@router.put("/{plan_id}", response_model=schemas.PlanCalibracionMantenimiento)
def update_plan_calibracion_mantenimiento(
    plan_id: int,
    plan: schemas.PlanCalibracionMantenimientoUpdate,
    db: Session = Depends(get_db),
):
    return services.modificar_plan_calibracion_mantenimiento(db, plan_id, plan)
