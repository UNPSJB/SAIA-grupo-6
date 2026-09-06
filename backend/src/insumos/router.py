import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.insumos import schemas, services

# Creamos un logger para este módulo específico. Más info.: https://docs.python.org/3/library/logging.html
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insumos", tags=["insumos"])

# Rutas para Insumos


@router.post("/", response_model=schemas.Insumo)
def create_insumo(insumo: schemas.InsumoCreate, db: Session = Depends(get_db)):
    return services.crear_insumo(db, insumo)


@router.get("/", response_model=list[schemas.Insumo])
def read_insumos(db: Session = Depends(get_db)):
    logger.info("Listando insumos desde router") # <- este mensaje se verá por la terminal
    return services.listar_insumos(db)


@router.get("/{insumo_id}", response_model=schemas.Insumo)
def read_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.leer_insumo(db, insumo_id)


@router.put("/{insumo_id}", response_model=schemas.Insumo)
def update_insumo(
    insumo_id: int, insumo: schemas.InsumoUpdate, db: Session = Depends(get_db)
):
    return services.modificar_insumo(db, insumo_id, insumo)


@router.delete("/{insumo_id}", response_model=schemas.InsumoDelete)
def delete_insumo(insumo_id: int, db: Session = Depends(get_db)):
    return services.eliminar_insumo(db, insumo_id)
