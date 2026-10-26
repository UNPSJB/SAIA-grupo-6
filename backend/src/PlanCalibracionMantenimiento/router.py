from fastapi import APIRouter, Depends, Query
from typing import Optional, Union
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.PlanCalibracionMantenimiento import schemas, services
from src.auth.dependencies import require_admin
from src.personal.models import Personal


# Sin dependencia global a propósito: cada endpoint declara la suya. Con
# `dependencies=[...]` a nivel de router y además `Depends(require_admin)` en
# el handler, un endpoint nuevo queda protegido solo si uno de los dos se
# acuerda.
_DEP_ADMIN = [Depends(require_admin)]

router = APIRouter(
    prefix="/planes-calibracion-mantenimiento",
    tags=["planes de calibración y mantenimiento"],
)


@router.post("", response_model=schemas.PlanCalibracionMantenimiento)
def create_plan_calibracion_mantenimiento(
    plan: schemas.PlanCalibracionMantenimientoCreate,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(require_admin),
):
    return services.crear_plan_calibracion_mantenimiento(db, plan, current_user.id)


@router.get(
    "",
    response_model=Union[
        list[schemas.PlanCalibracionMantenimiento],
        schemas.PlanCalibracionMantenimientoPagina,
    ],
    dependencies=_DEP_ADMIN,
)
def read_planes_calibracion_mantenimiento(
    incluir_inactivos: bool = False,
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usa el tablero).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_planes_calibracion_mantenimiento(db, incluir_inactivos)
    items, total = services.listar_planes_calibracion_mantenimiento_paginado(
        db, incluir_inactivos, page, page_size
    )
    return schemas.PlanCalibracionMantenimientoPagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/{plan_id}",
    response_model=schemas.PlanCalibracionMantenimiento,
    dependencies=_DEP_ADMIN,
)
def read_plan_calibracion_mantenimiento(
    plan_id: int,
    db: Session = Depends(get_db),
):
    return services.leer_plan_calibracion_mantenimiento(db, plan_id)


@router.put(
    "/{plan_id}",
    response_model=schemas.PlanCalibracionMantenimiento,
    dependencies=_DEP_ADMIN,
)
def update_plan_calibracion_mantenimiento(
    plan_id: int,
    plan: schemas.PlanCalibracionMantenimientoUpdate,
    db: Session = Depends(get_db),
):
    return services.modificar_plan_calibracion_mantenimiento(db, plan_id, plan)


@router.delete(
    "/{plan_id}",
    response_model=schemas.PlanCalibracionMantenimiento,
    dependencies=_DEP_ADMIN,
)
def delete_plan_calibracion_mantenimiento(
    plan_id: int,
    db: Session = Depends(get_db),
):
    """Baja lógica del plan: se marca `activo = False` y se puede reactivar."""
    return services.dar_de_baja_plan_calibracion_mantenimiento(db, plan_id)
