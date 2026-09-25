from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.database import get_db
from . import schemas, services

router = APIRouter(
    prefix="/elementos-limpieza",
    tags=["Elementos de Limpieza"]
)


@router.post(
    "",
    response_model=schemas.ElementoLimpiezaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_elemento_limpieza(
    datos: schemas.ElementoLimpiezaCreate,
    db: Session = Depends(get_db),
):
  return services.crear_elemento_limpieza(db, datos)


@router.get(
    "",
    response_model=list[schemas.ElementoLimpiezaResponse],
)
def listar_elementos_limpieza(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
  return services.listar_elementos_limpieza(db, incluir_inactivos)


@router.get(
    "/{elemento_id}",
    response_model=schemas.ElementoLimpiezaResponse,
)
def obtener_elemento_limpieza(
    elemento_id: int,
    db: Session = Depends(get_db),
):
  return services.obtener_elemento_limpieza(db, elemento_id)


@router.patch(
    "/{elemento_id}",
    response_model=schemas.ElementoLimpiezaResponse,
)
def actualizar_elemento_limpieza(
    elemento_id: int,
    datos: schemas.ElementoLimpiezaUpdate,
    db: Session = Depends(get_db),
):
  return services.actualizar_elemento_limpieza(db, elemento_id, datos)


@router.delete(
    "/{elemento_id}",
    response_model=schemas.ElementoLimpiezaResponse,
)
def dar_de_baja_elemento_limpieza(
    elemento_id: int,
    db: Session = Depends(get_db),
):
  return services.dar_de_baja_elemento_limpieza(db, elemento_id)


# --- Endpoint especifico del modulo ---
@router.post(
    "/{elemento_id}/recambio",
    response_model=schemas.ElementoLimpiezaResponse,
)
def registrar_recambio_elemento(
    elemento_id: int,
    db: Session = Depends(get_db),
):
  return services.registrar_recambio_elemento(db, elemento_id)