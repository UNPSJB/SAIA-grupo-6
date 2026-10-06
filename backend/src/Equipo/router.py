from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.auth.dependencies import require_admin, require_operador
from . import schemas, services

# Sin dependencia global: cada endpoint declara lo que necesita.
# Leer la lista de equipos es parte de lo operativo (por ejemplo, para
# reportar un incidente), pero modificar el maestro es solo del administrador.
router = APIRouter(
    prefix="/equipos",
    tags=["Equipos"],
)

@router.post(
    "",
    response_model=schemas.EquipoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)]
)
def crear_equipo(
    datos: schemas.EquipoCreate,
    db: Session = Depends(get_db)
):
    return services.crear_equipo(db, datos)

@router.get(
    "",
    response_model=list[schemas.EquipoResponse],
    dependencies=[Depends(require_operador)]
)
def listar_equipos(
    incluir_inactivos: bool = False,
    db:Session = Depends(get_db)
):
    return services.listar_equipos(db, incluir_inactivos)

@router.get(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_operador)]
)
def obtener_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.obtener_equipo(db, equipo_id)

@router.patch(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_admin)]
)
def actualizar_equipo(
    equipo_id: int,
    datos: schemas.EquipoUpdate,
    db: Session = Depends(get_db)
):
    return services.actualizar_equipo(
        db,
        equipo_id,
        datos
    )

@router.delete(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse,
    dependencies=[Depends(require_admin)]
)
def dar_de_baja_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.dar_de_baja_equipo(
        db,
        equipo_id
    )

