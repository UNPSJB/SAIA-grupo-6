from typing import List, Optional, Union

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.aptitud import schemas, services
from src.auth.dependencies import require_admin


router = APIRouter(
    prefix="/aptitudes",
    tags=["Aptitudes"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.AptitudResponse, status_code=status.HTTP_201_CREATED)
def crear_aptitud(datos: schemas.AptitudCreate, db: Session = Depends(get_db)):
    return services.crear_aptitud(db, datos)


@router.get("", response_model=Union[List[schemas.AptitudResponse], schemas.AptitudPagina])
def listar_aptitudes(
    incluir_inactivos: bool = False,
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_aptitudes(db, incluir_inactivos)
    items, total = services.listar_aptitudes_paginado(db, incluir_inactivos, page, page_size)
    return schemas.AptitudPagina(items=items, total=total, page=page, page_size=page_size)


@router.get("/{aptitud_id}", response_model=schemas.AptitudResponse)
def obtener_aptitud(aptitud_id: int, db: Session = Depends(get_db)):
    return services.obtener_aptitud(db, aptitud_id)


@router.put("/{aptitud_id}", response_model=schemas.AptitudResponse)
def actualizar_aptitud(aptitud_id: int, datos: schemas.AptitudUpdate, db: Session = Depends(get_db)):
    return services.actualizar_aptitud(db, aptitud_id, datos)


@router.delete("/{aptitud_id}", response_model=schemas.AptitudResponse)
def eliminar_aptitud(aptitud_id: int, db: Session = Depends(get_db)):
    return services.eliminar_aptitud(db, aptitud_id)
