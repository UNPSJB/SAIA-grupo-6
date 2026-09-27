import logging
from typing import List
from fastapi import HTTPException
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

    - Si pertenece a alguien ACTIVO -> error de negocio normal.
    - Si pertenece a alguien INACTIVO -> conflicto para ofrecer reactivación.
    - Si no existe -> el valor está disponible.
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


def crear_persona(
    db: Session,
    persona: schemas.PersonaCreate
) -> Personal:

    # Verificamos previamente si DNI/email ya están utilizados.
    _verificar_disponibilidad(db, "dni", persona.dni)
    _verificar_disponibilidad(db, "email", persona.email)

    _persona = Personal(**persona.model_dump())
    db.add(_persona)

    try:
        db.commit()
        db.refresh(_persona)
        return _persona

    except IntegrityError as e:
        db.rollback()

        # Dejamos este manejo como respaldo por si la BD
        # detecta una restricción de integridad que no verificamos antes.
        mensaje_error = str(e.orig).lower()

        if "dni" in mensaje_error:
            raise exceptions.DniDuplicado()

        elif "email" in mensaje_error:
            raise exceptions.EmailDuplicado()

        else:
            raise exceptions.DatoDuplicado()


def listar_personas(
    db: Session,
    incluir_inactivos: bool = False
) -> List[Personal]:

    logger.info(
        "Listando personal desde services (incluir_inactivos=%s)",
        incluir_inactivos
    )

    query = select(Personal)

    if not incluir_inactivos:
        query = query.where(Personal.activo.is_(True))

    return db.scalars(query).all()


def leer_persona(
    db: Session,
    persona_id: int
) -> Personal:

    db_persona = db.scalar(
        select(Personal).where(Personal.id == persona_id)
    )

    if db_persona is None:
        raise exceptions.PersonaNoEncontrada()

    return db_persona


def modificar_persona(
    db: Session,
    persona_id: int,
    persona: schemas.PersonaUpdate
) -> Personal:

    db_persona = leer_persona(db, persona_id)

    # Solo actualizamos los campos que realmente fueron enviados.
    datos_a_actualizar = persona.model_dump(exclude_unset=True)

    if datos_a_actualizar:
        try:
            db.execute(
                update(Personal)
                .where(Personal.id == persona_id)
                .values(**datos_a_actualizar)
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


def eliminar_persona(
    db: Session,
    persona_id: int
) -> Personal:

    db_persona = leer_persona(db, persona_id)

    # BAJA LÓGICA
    db_persona.activo = False

    db.commit()
    db.refresh(db_persona)

    return db_persona

def autenticar_persona(db: Session, dni: str, password: str):
    # 1. Buscamos a la persona SOLO por su DNI
    persona = db.scalar(
        select(Personal).where(Personal.dni == dni)
    )
    
    # 2. Si no encontramos a nadie con ese DNI, tiramos el error específico
    if not persona:
        raise HTTPException(
            status_code=404, 
            detail="El DNI ingresado no está registrado en el sistema."
        )
    
    # 3. Si el DNI existe, pero la contraseña está mal
    if persona.password != password:
        raise HTTPException(
            status_code=401, 
            detail="La contraseña es incorrecta."
        )
    
    # 4. Si la contraseña es correcta, revisamos si está dado de baja
    if not persona.activo:
        raise HTTPException(
            status_code=403, 
            detail="Este usuario se encuentra dado de baja. Comunicate con un administrador para reactivarlo."
        )
    
    # 5. Si pasó todos los filtros, lo dejamos entrar
    return persona