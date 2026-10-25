from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.sector import schemas, services
from src.auth.dependencies import require_admin


router = APIRouter(
    prefix="/sectores",
    tags=["Sectores"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.SectorResponse, status_code=status.HTTP_201_CREATED)
def crear_sector(datos: schemas.SectorCreate, db: Session = Depends(get_db)):
    return services.crear_sector(db, datos)


@router.get("", response_model=List[schemas.SectorResponse])
def listar_sectores(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_sectores(db, incluir_inactivos)


@router.get("/{sector_id}", response_model=schemas.SectorResponse)
def obtener_sector(sector_id: int, db: Session = Depends(get_db)):
    return services.obtener_sector(db, sector_id)


@router.put("/{sector_id}", response_model=schemas.SectorResponse)
def actualizar_sector(sector_id: int, datos: schemas.SectorUpdate, db: Session = Depends(get_db)):
    return services.actualizar_sector(db, sector_id, datos)


@router.delete("/{sector_id}", response_model=schemas.SectorResponse)
def eliminar_sector(sector_id: int, db: Session = Depends(get_db)):
    return services.eliminar_sector(db, sector_id)