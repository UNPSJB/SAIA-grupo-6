import logging
from typing import List
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.personal.models import Personal
from src.personal import schemas, exceptions
from src.exceptions import ConflictoRegistroInactivo

logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA PERSONAL
# ==========================================


def _verificar_disponibilidad(db: Session, campo: str, valor: str) -> None:
    """
    Chequea si `valor` (dni o email) ya está en uso, solo para el ALTA.

    - Si pertenece a alguien ACTIVO -> error de negocio normal (DniDuplicado/EmailDuplicado).
    - Si pertenece a alguien INACTIVO -> no lo bloqueamos: devolvemos un 409
      para que el frontend ofrezca reactivarlo con los datos nuevos
      (reutilizando el PUT /personal/{id} normal, con activo=true).
    - Si no existe -> no hacemos nada, el valor está disponible.
    """
    columna = getattr(Personal, campo)
    existente = db.scalar(select(Personal).where(columna == valor))

    if existente is None:
        return

    if existente.activo:
        if campo == "dni":
            raise exceptions.DniDuplicado()
        raise exceptions.EmailDuplicado()

    nombre_completo = f"{existente.nombre} {existente.apellido or ''}".strip()
    raise ConflictoRegistroInactivo(
        mensaje=(
            f"Ya existe una persona dada de baja con este {campo.upper()} "
            f"({nombre_completo}). ¿Querés reactivarla con estos datos?"
        ),
        entidad_id=existente.id,
        campo=campo,
    )


def crear_persona(db: Session, persona: schemas.PersonaCreate) -> Personal:
    # Validamos ANTES de insertar (así distinguimos "duplicado activo" de
    # "duplicado inactivo", cosa que un simple catch de IntegrityError no permite)
    _verificar_disponibilidad(db, "dni", persona.dni)
    _verificar_disponibilidad(db, "email", persona.email)

    _persona = Personal(**persona.model_dump())
    db.add(_persona)

    try:
        db.commit()
        db.refresh(_persona)
        return _persona
    except IntegrityError:
        db.rollback()
        raise exceptions.DatoDuplicado()


def listar_personas(db: Session, incluir_inactivos: bool = False) -> List[Personal]:
    logger.info("Listando personal desde services (incluir_inactivos=%s)", incluir_inactivos)
    query = select(Personal)
    if not incluir_inactivos:
        query = query.where(Personal.activo == True)  # noqa: E712
    return db.scalars(query).all()


def leer_persona(db: Session, persona_id: int) -> Personal:
    db_persona = db.scalar(select(Personal).where(Personal.id == persona_id))
    if db_persona is None:
        raise exceptions.PersonaNoEncontrada()
    return db_persona


def modificar_persona(
    db: Session, persona_id: int, persona: schemas.PersonaUpdate
) -> Personal:
    # primero tengo q verificar que exista lol
    db_persona = leer_persona(db, persona_id)

    # exclude_unset=True hace q solo se actualicen los campos que el frontend realmente envió
    # (esto incluye "activo": True cuando el frontend está reactivando a alguien)
    datos_a_actualizar = persona.model_dump(exclude_unset=True)

    if datos_a_actualizar:
        try:
            db.execute(
                update(Personal).where(Personal.id == persona_id).values(**datos_a_actualizar)
            )
            db.commit()
            db.refresh(db_persona)
        except IntegrityError as e:
            db.rollback()
            mensaje_error = str(e.orig).lower()
            if "dni" in mensaje_error:
                raise exceptions.DniDuplicado()
            elif "email" in mensaje_error:
                raise exceptions.EmailDuplicado()
            else:
                raise exceptions.DatoDuplicado()

    return db_persona


def eliminar_persona(db: Session, persona_id: int) -> Personal:
    # busco
    db_persona = leer_persona(db, persona_id)

    # BAJA LÓGICA: en vez de borrarla de la bd, le cambio el estado a inactivo
    db_persona.activo = False
    db.commit()
    db.refresh(db_persona)

    return db_persona
