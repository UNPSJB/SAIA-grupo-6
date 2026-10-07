from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
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


@router.get("", response_model=List[schemas.AptitudResponse])
def listar_aptitudes(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_aptitudes(db, incluir_inactivos)


@router.get("/{aptitud_id}", response_model=schemas.AptitudResponse)
def obtener_aptitud(aptitud_id: int, db: Session = Depends(get_db)):
    return services.obtener_aptitud(db, aptitud_id)


@router.put("/{aptitud_id}", response_model=schemas.AptitudResponse)
def actualizar_aptitud(aptitud_id: int, datos: schemas.AptitudUpdate, db: Session = Depends(get_db)):
    return services.actualizar_aptitud(db, aptitud_id, datos)


@router.delete("/{aptitud_id}", response_model=schemas.AptitudResponse)
def eliminar_aptitud(aptitud_id: int, db: Session = Depends(get_db)):
    return services.eliminar_aptitud(db, aptitud_id)
