import logging
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.insumoQuimico import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insumos-quimicos", tags=["Insumos Químicos"])

@router.post("", response_model=schemas.InsumoQuimicoResponse, status_code=status.HTTP_201_CREATED)
def crear_insumo_quimico(datos: schemas.InsumoQuimicoCreate, db: Session = Depends(get_db)):
    return services.crear_insumo_quimico(db, datos)

@router.get("", response_model=List[schemas.InsumoQuimicoResponse])
def listar_insumos_quimicos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_insumos_quimicos(db, incluir_inactivos)

@router.get("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse)
def obtener_insumo_quimico(insumo_id: int, db: Session = Depends(get_db)):
    return services.obtener_insumo_quimico(db, insumo_id)

@router.put("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse)
def actualizar_insumo_quimico(insumo_id: int, datos: schemas.InsumoQuimicoUpdate, db: Session = Depends(get_db)):
    return services.actualizar_insumo_quimico(db, insumo_id, datos)

@router.delete("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse)
def eliminar_insumo_quimico(insumo_id: int, db: Session = Depends(get_db)):
    return services.eliminar_insumo_quimico(db, insumo_id)

