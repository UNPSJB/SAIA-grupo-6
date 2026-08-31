import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.mascotas import schemas, services

# Creamos un logger para este módulo específico. Más info.: https://docs.python.org/3/library/logging.html
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mascotas", tags=["mascotas"])

# Rutas para Mascotas


@router.post("/", response_model=schemas.Mascota)
def create_mascota(mascota: schemas.MascotaCreate, db: Session = Depends(get_db)):
    return services.crear_mascota(db, mascota)


@router.get("/", response_model=list[schemas.Mascota])
def read_mascotas(db: Session = Depends(get_db)):
    logger.info("Listando mascotas desde router") # <- este mensaje se verá por la terminal
    return services.listar_mascotas(db)


@router.get("/{mascota_id}", response_model=schemas.Mascota)
def read_mascota(mascota_id: int, db: Session = Depends(get_db)):
    return services.leer_mascota(db, mascota_id)


@router.put("/{mascota_id}", response_model=schemas.Mascota)
def update_mascota(
    mascota_id: int, mascota: schemas.MascotaUpdate, db: Session = Depends(get_db)
):
    return services.modificar_mascota(db, mascota_id, mascota)


@router.delete("/{mascota_id}", response_model=schemas.MascotaDelete)
def delete_mascota(mascota_id: int, db: Session = Depends(get_db)):
    return services.eliminar_mascota(db, mascota_id)
