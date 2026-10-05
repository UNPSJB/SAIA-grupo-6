import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.auth.dependencies import require_admin, require_operador
from . import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/elementos-limpieza",
    tags=["Elementos de Limpieza"],
)

# Gestión del catálogo: solo quien administra.
_DEP_ADMIN = [Depends(require_admin)]

# Listado mínimo para completar el checklist: alcanza con tener sesión operativa.
_DEP_OPERAR = [Depends(require_operador)]


@router.get(
    "/opciones",
    response_model=List[schemas.ElementoLimpiezaOpcion],
    dependencies=_DEP_OPERAR,
)
def listar_opciones_elementos(db: Session = Depends(get_db)):
  """Datos mínimos (id y nombre) para que el operario elija el elemento
  utilizado al marcar una tarea del checklist."""
  return services.listar_opciones_elementos(db)


@router.post(
    "",
    response_model=schemas.ElementoLimpiezaResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_DEP_ADMIN,
)
def crear_elemento_limpieza(
    datos: schemas.ElementoLimpiezaCreate,
    db: Session = Depends(get_db),
):
  return services.crear_elemento_limpieza(db, datos)


@router.get(
    "",
    response_model=list[schemas.ElementoLimpiezaResponse],
    dependencies=_DEP_ADMIN,
)
def listar_elementos_limpieza(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
  return services.listar_elementos_limpieza(db, incluir_inactivos)


@router.get(
    "/{elemento_id}",
    response_model=schemas.ElementoLimpiezaResponse,
    dependencies=_DEP_ADMIN,
)
def obtener_elemento_limpieza(
    elemento_id: int,
    db: Session = Depends(get_db),
):
  return services.obtener_elemento_limpieza(db, elemento_id)


@router.patch(
    "/{elemento_id}",
    response_model=schemas.ElementoLimpiezaResponse,
    dependencies=_DEP_ADMIN,
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
    dependencies=_DEP_ADMIN,
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
    dependencies=_DEP_ADMIN,
)
def registrar_recambio_elemento(
    elemento_id: int,
    db: Session = Depends(get_db),
):
  return services.registrar_recambio_elemento(db, elemento_id)