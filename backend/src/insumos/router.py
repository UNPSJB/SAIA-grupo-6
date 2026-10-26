import logging
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin
from src.insumos import schemas, services

# Creamos un logger para este módulo específico. Más info.: https://docs.python.org/3/library/logging.html
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insumos", tags=["insumos"], dependencies=[Depends(require_admin)])

# Rutas para Insumos


@router.post("", response_model=schemas.Insumo)
def create_insumo(insumo: schemas.InsumoCreate, db: Session = Depends(get_db)):
    return services.crear_insumo(db, insumo)


@router.get("", response_model=Union[List[schemas.Insumo], schemas.InsumoPagina])
def read_insumos(
    incluir_inactivos: bool = False,
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    logger.info("Listando insumos desde router (incluir_inactivos=%s)", incluir_inactivos)
    if page is None:
        return services.listar_insumos(db, incluir_inactivos)
    items, total = services.listar_insumos_paginado(db, incluir_inactivos, page, page_size)
    return schemas.InsumoPagina(items=items, total=total, page=page, page_size=page_size)


@router.get("/{insumo_id}", response_model=schemas.Insumo)
def read_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.leer_insumo(db, insumo_id)


@router.put("/{insumo_id}", response_model=schemas.Insumo)
def update_insumo(
    insumo_id: int, insumo: schemas.InsumoUpdate, db: Session = Depends(get_db)
):
    return services.modificar_insumo(db, insumo_id, insumo)


@router.delete("/{insumo_id}", response_model=schemas.Insumo)
def delete_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.eliminar_insumo(db, insumo_id)
