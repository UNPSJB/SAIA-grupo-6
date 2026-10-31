from typing import List, Literal, Optional, Union
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.sector import schemas, services
from src.auth.dependencies import require_admin


router = APIRouter(
    prefix="/sectores",
    tags=["Sectores"],
    dependencies=[Depends(require_admin)],
)

OrdenSector = Literal[
    "nombre_asc",
    "nombre_desc",
    "descripcion_asc",
    "descripcion_desc",
]


@router.post("", response_model=schemas.SectorResponse, status_code=status.HTTP_201_CREATED)
def crear_sector(datos: schemas.SectorCreate, db: Session = Depends(get_db)):
    return services.crear_sector(db, datos)


@router.get("", response_model=Union[List[schemas.SectorResponse], schemas.SectorPagina])
def listar_sectores(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en nombre y descripción (sin distinguir mayúsculas ni tildes).",
    ),
    orden: OrdenSector = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_sectores(db, incluir_inactivos, buscar)
    items, total = services.listar_sectores_paginado(
        db, incluir_inactivos, page, page_size, buscar=buscar, orden=orden
    )
    return schemas.SectorPagina(items=items, total=total, page=page, page_size=page_size)


@router.get("/{sector_id}", response_model=schemas.SectorResponse)
def obtener_sector(sector_id: int, db: Session = Depends(get_db)):
    return services.obtener_sector(db, sector_id)


@router.put("/{sector_id}", response_model=schemas.SectorResponse)
def actualizar_sector(sector_id: int, datos: schemas.SectorUpdate, db: Session = Depends(get_db)):
    return services.actualizar_sector(db, sector_id, datos)


@router.delete("/{sector_id}", response_model=schemas.SectorResponse)
def eliminar_sector(sector_id: int, db: Session = Depends(get_db)):
    return services.eliminar_sector(db, sector_id)