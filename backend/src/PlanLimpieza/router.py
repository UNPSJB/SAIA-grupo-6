import logging
from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin
from src.PlanLimpieza import schemas, services

# Creamos un logger para este módulo específico
logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /planes-limpieza
router = APIRouter(prefix="/planes-limpieza", tags=["planes de limpieza"], dependencies=[Depends(require_admin)])

OrdenPlanLimpieza = Literal[
    "nombre_asc", "nombre_desc", "equipo_asc", "equipo_desc"
]


@router.post("", response_model=schemas.PlanLimpieza)
def create_plan_limpieza(
    plan: schemas.PlanLimpiezaCreate, db: Session = Depends(get_db)
):
    return services.crear_plan_limpieza(db, plan)


@router.get("", response_model=Union[List[schemas.PlanLimpieza], schemas.PlanLimpiezaPagina])
def read_planes_limpieza(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en el nombre del plan, el del equipo y sus tareas (sin distinguir mayúsculas ni tildes).",
    ),
    equipo_id: Optional[int] = Query(None, ge=1),
    orden: OrdenPlanLimpieza = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    logger.info(
        "Consultando la lista de planes de limpieza (incluir_inactivos=%s)",
        incluir_inactivos,
    )
    if page is None:
        return services.listar_planes_limpieza(
            db, incluir_inactivos, buscar, equipo_id
        )
    items, total = services.listar_planes_limpieza_paginado(
        db,
        incluir_inactivos,
        page,
        page_size,
        buscar=buscar,
        equipo_id=equipo_id,
        orden=orden,
    )
    return schemas.PlanLimpiezaPagina(
        items=items, total=total, page=page, page_size=page_size
    )

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