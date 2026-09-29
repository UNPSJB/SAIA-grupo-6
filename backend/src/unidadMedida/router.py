import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.unidadMedida import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/unidades-medida", tags=["Unidades de Medida"])


@router.post("", response_model=schemas.UnidadMedidaResponse, status_code=status.HTTP_201_CREATED)
def crear_unidad_medida(datos: schemas.UnidadMedidaCreate, db: Session = Depends(get_db)):
    return services.crear_unidad_medida(db, datos)


@router.get("", response_model=List[schemas.UnidadMedidaResponse])
def listar_unidades_medida(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_unidades_medida(db, incluir_inactivos)


@router.get("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def obtener_unidad_medida(unidad_id: int, db: Session = Depends(get_db)):
    return services.obtener_unidad_medida(db, unidad_id)


@router.put("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def actualizar_unidad_medida(unidad_id: int, datos: schemas.UnidadMedidaUpdate, db: Session = Depends(get_db)):
    return services.actualizar_unidad_medida(db, unidad_id, datos)


@router.delete("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def eliminar_unidad_medida(unidad_id: int, db: Session = Depends(get_db)):
    return services.eliminar_unidad_medida(db, unidad_id)
