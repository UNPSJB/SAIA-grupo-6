from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.database import get_db
from . import schemas, services

router = APIRouter(
    prefix="/equipos",
    tags=["Equipos"]
)

@router.post(
    "",
    response_model=schemas.EquipoResponse,
    status_code=status.HTTP_201_CREATED
)
def crear_equipo(
    datos: schemas.EquipoCreate,
    db: Session = Depends(get_db)
):
    return services.crear_equipo(db, datos)

@router.get(
    "",
    response_model=list[schemas.EquipoResponse]
)
def listar_equipo(
    db:Session = Depends(get_db)
):
    return services.listar_equipos(db)

@router.get(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse
)
def obtener_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.obtener_equipo(db, equipo_id)

@router.patch(
    "/{equipo_id}",
    response_model=schemas.EquipoResponse
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
    response_model=schemas.EquipoResponse
)
def dar_de_baja_equipo(
    equipo_id: int,
    db: Session = Depends(get_db)
):
    return services.dar_de_baja_equipo(
        db,
        equipo_id
    )

