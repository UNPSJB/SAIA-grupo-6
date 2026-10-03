import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.database import get_db
from src.personal import schemas, services
from src.personal.models import Personal
from src.auth.dependencies import get_current_user, require_admin, get_current_user_opcional
from src.auth.roles import (
    exige_permiso_para_editar,
    puede_administrar,
    puede_editar_a,
    puede_modificar_roles,
)

logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /personal
router = APIRouter(prefix="/personal", tags=["personal"])


@router.post("", response_model=schemas.Persona)
def create_persona(
    persona: schemas.PersonaCreate,
    db: Session = Depends(get_db),
    current_user: Optional[Personal] = Depends(get_current_user_opcional),
):
    """Alta de personal.

    Solo quien administra. Excepción de arranque: si la base no tiene ninguna
    persona todavía se permite crear la primera sin sesión, para no quedar sin
    acceso a un sistema recién instalado.
    """
    hay_personas = (db.scalar(select(func.count(Personal.id))) or 0) > 0

    if hay_personas:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Debés iniciar sesión para crear personal.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        exige_permiso_para_editar(
            puede_administrar(current_user),
            "Se requiere permiso de administrar para dar de alta personal.",
        )

    return services.crear_persona(db, persona)


# La gestión de personal es una historia de administración: el listado y el
# detalle quedan restringidos a quien administra.
@router.get("", response_model=List[schemas.Persona], dependencies=[Depends(require_admin)])
def read_personas(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    logger.info("Consultando la lista de personal (incluir_inactivos=%s)", incluir_inactivos)
    return services.listar_personas(db, incluir_inactivos)


@router.get("/{persona_id}", response_model=schemas.Persona, dependencies=[Depends(require_admin)])
def read_persona(persona_id: int, db: Session = Depends(get_db)):
    return services.leer_persona(db, persona_id)


@router.put("/{persona_id}", response_model=schemas.Persona)
def update_persona(
    persona_id: int,
    persona: schemas.PersonaUpdate,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(get_current_user),
):
    """Modificación de una persona, respetando la jerarquía de roles.

    Editar tu propio perfil está permitido para cualquiera; tocar datos de otra
    persona requiere permiso de administrar. Esto evita que un operador se
    auto-asigne puede_administrar.
    """
    objetivo = services.leer_persona(db, persona_id)

    exige_permiso_para_editar(
        puede_editar_a(current_user, objetivo),
        "No tenés permiso para modificar a esta persona.",
    )

    datos = persona.model_dump(exclude_unset=True)
    toca_roles = {"puede_operar", "puede_administrar", "activo"} & datos.keys()

    if toca_roles:
        exige_permiso_para_editar(
            puede_modificar_roles(current_user, objetivo),
            "Necesitás permiso de administrar para cambiar capacidades o el estado de una persona.",
        )

    return services.modificar_persona(db, persona_id, persona)


@router.delete("/{persona_id}", response_model=schemas.Persona)
def delete_persona(
    persona_id: int,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(require_admin),
):
    """Baja lógica de una persona: un admin solo puede dar de baja a operadores."""
    objetivo = services.leer_persona(db, persona_id)

    if current_user.id == objetivo.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No podés darte de baja a vos mismo.",
        )

    exige_permiso_para_editar(
        puede_editar_a(current_user, objetivo),
        "No tenés permiso para dar de baja a esta persona.",
    )

    return services.eliminar_persona(db, persona_id)