import logging
from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin
from src.ingredientes import schemas, services

# Creamos un logger para este módulo específico. Más info.: https://docs.python.org/3/library/logging.html
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingredientes", tags=["ingredientes"], dependencies=[Depends(require_admin)])

OrdenIngrediente = Literal["nombre_asc", "nombre_desc", "unidad_asc", "unidad_desc"]

# Rutas para Ingredientes


@router.post("", response_model=schemas.Ingrediente)
def create_ingrediente(ingrediente: schemas.IngredienteCreate, db: Session = Depends(get_db)):
    return services.crear_ingrediente(db, ingrediente)


@router.get("", response_model=Union[List[schemas.Ingrediente], schemas.IngredientePagina])
def read_ingredientes(
    incluir_inactivos: bool = False,
    solo_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en nombre, unidad y símbolo (sin distinguir mayúsculas ni tildes).",
    ),
    unidad_medida_id: Optional[int] = Query(None, ge=1),
    proveedor_id: Optional[int] = Query(None, ge=1),
    es_aditivo: Optional[bool] = Query(
        None,
        description="true: solo aditivos; false: solo los que no son aditivos. Sin este parámetro se devuelven todos.",
    ),
    orden: OrdenIngrediente = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    logger.info(
        "Listando ingredientes desde router (incluir_inactivos=%s, es_aditivo=%s)",
        incluir_inactivos,
        es_aditivo,
    )
    if page is None:
        return services.listar_ingredientes(
            db, incluir_inactivos, buscar, unidad_medida_id, es_aditivo, proveedor_id
        )
    items, total = services.listar_ingredientes_paginado(
        db,
        incluir_inactivos,
        page,
        page_size,
        buscar=buscar,
        unidad_medida_id=unidad_medida_id,
        orden=orden,
        es_aditivo=es_aditivo,
        solo_inactivos=solo_inactivos,
        proveedor_id=proveedor_id,
    )
    return schemas.IngredientePagina(items=items, total=total, page=page, page_size=page_size)


@router.get("/{ingrediente_id}", response_model=schemas.Ingrediente)
def read_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    return services.leer_ingrediente(db, ingrediente_id)


@router.put("/{ingrediente_id}", response_model=schemas.Ingrediente)
def update_ingrediente(
    ingrediente_id: int, ingrediente: schemas.IngredienteUpdate, db: Session = Depends(get_db)
):
    return services.modificar_ingrediente(db, ingrediente_id, ingrediente)


@router.delete("/{ingrediente_id}", response_model=schemas.Ingrediente)
def delete_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    return services.eliminar_ingrediente(db, ingrediente_id)