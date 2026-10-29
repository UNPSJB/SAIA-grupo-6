from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin, require_operador
from . import schemas, services


router = APIRouter(
    prefix="/elementos-limpieza",
    tags=["Elementos de Limpieza"],
)

# Gestión del catálogo: solo quien administra.
_DEP_ADMIN = [Depends(require_admin)]

# Listado mínimo para completar el checklist: alcanza con tener sesión operativa.
_DEP_OPERAR = [Depends(require_operador)]

OrdenElementoLimpieza = Literal[
    "nombre_asc",
    "nombre_desc",
    "ultimo_recambio_asc",
    "ultimo_recambio_desc",
    "frecuencia_asc",
    "frecuencia_desc",
]


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
    response_model=Union[List[schemas.ElementoLimpiezaResponse], schemas.ElementoLimpiezaPagina],
    dependencies=_DEP_ADMIN,
)
def listar_elementos_limpieza(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en el nombre (sin distinguir mayúsculas ni tildes).",
    ),
    orden: OrdenElementoLimpieza = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_elementos_limpieza(db, incluir_inactivos, buscar)
    items, total = services.listar_elementos_limpieza_paginado(
        db, incluir_inactivos, page, page_size, buscar=buscar, orden=orden
    )
    return schemas.ElementoLimpiezaPagina(
        items=items, total=total, page=page, page_size=page_size
    )


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