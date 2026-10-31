import logging
from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.personal import schemas, services
from src.personal.models import Personal
from src.auth.dependencies import get_current_user, require_admin, get_current_user_opcional
from src.auth.roles import (
    es_super_admin,
    exige_permiso_para_editar,
    puede_administrar,
    puede_editar_a,
    puede_modificar_roles,
)
from src.roles_service import contar_personas, hay_administradores

logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /personal
router = APIRouter(prefix="/personal", tags=["personal"])

RolPersonal = Literal["super_admin", "administrador", "operador"]
OrdenPersonal = Literal["nombre_asc", "nombre_desc", "dni_asc", "dni_desc"]


@router.post("", response_model=schemas.Persona)
def create_persona(
    persona: schemas.PersonaCreate,
    db: Session = Depends(get_db),
    current_user: Optional[Personal] = Depends(get_current_user_opcional),
):
    """Alta de personal.

    Solo quien administra (o un super admin). Excepción de arranque: mientras el
    sistema no tenga ningún administrador, se permite crear el primero sin
    sesión — es lo que posibilita levantar la aplicación en una base nueva sin
    quedar afuera.
    """
    total_personas = contar_personas(db)
    ya_hay_admin = hay_administradores(db)

    # Bootstrap: no hay nadie todavía, o hay usuarios pero ninguno administra.
    es_arranque = not ya_hay_admin

    if not es_arranque:
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

    # Crear un super admin: solo otro super admin, salvo en el arranque.
    if getattr(persona, "es_super_admin", False) and not es_arranque:
        if not (current_user is not None and es_super_admin(current_user)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un super administrador puede dar de alta a otro super administrador.",
            )

    if total_personas == 0:
        logger.warning(
            "Bootstrap: se crea el primer usuario del sistema (id=%s)",
            getattr(current_user, "id", None),
        )

    return services.crear_persona(db, persona)


@router.get("", response_model=Union[List[schemas.Persona], schemas.PersonaPagina], dependencies=[Depends(require_admin)])
def read_personas(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en nombre, apellido, DNI y email (sin distinguir mayúsculas ni tildes).",
    ),
    rol: Optional[RolPersonal] = Query(None),
    orden: OrdenPersonal = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    logger.info("Consultando la lista de personal (incluir_inactivos=%s)", incluir_inactivos)
    if page is None:
        return services.listar_personas(db, incluir_inactivos, buscar, rol)
    items, total = services.listar_personas_paginado(
        db, incluir_inactivos, page, page_size, buscar=buscar, rol=rol, orden=orden
    )
    return schemas.PersonaPagina(items=items, total=total, page=page, page_size=page_size)


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
    """Modificación de una persona, respetando la jerarquía de roles:

    * super admin -> cualquiera
    * admin       -> operadores y sí mismo
    * operador    -> solo sí mismo
    """
    objetivo = services.leer_persona(db, persona_id)

    if not puede_editar_a(current_user, objetivo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "No tenés permiso para modificar a esta persona."
                if current_user.id != objetivo.id
                else "No tenés permiso para modificar tu propia cuenta."
            ),
        )

    datos = persona.model_dump(exclude_unset=True)

    ROLES = ("puede_operar", "puede_administrar", "es_super_admin", "activo")
    toca_roles = {
        campo for campo in ROLES
        if campo in datos and datos[campo] != getattr(objetivo, campo)
    }

    if toca_roles:
        exige_permiso_para_editar(
            puede_modificar_roles(current_user, objetivo),
            "Necesitás permiso de administrar para cambiar capacidades o el estado de una persona.",
        )

    if "es_super_admin" in toca_roles:
        exige_permiso_para_editar(
            es_super_admin(current_user),
            "Solo un super administrador puede cambiar el flag de super administrador.",
        )

    updated = services.modificar_persona(db, persona_id, persona)

    # Gestionar flag debe_cambiar_password al cambiar contraseña
    if "password" in datos and datos["password"]:
        if current_user.id == persona_id:
            # Cambio propio: ya no debe cambiar
            updated.debe_cambiar_password = False
        else:
            # Cambio por admin: debe cambiar
            updated.debe_cambiar_password = True
        db.add(updated)
        db.commit()
        db.refresh(updated)

    return updated


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