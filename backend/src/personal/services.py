import logging
from typing import List
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.personal.models import Persona
from src.personal import schemas, exceptions

# Creamos un logger para este módulo específico. 
logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA PERSONAL
# ==========================================

def crear_persona(db: Session, persona: schemas.PersonaCreate) -> Persona:
    # Transformamos el schema de Pydantic a un modelo de SQLAlchemy
    _persona = Persona(**persona.model_dump())
    db.add(_persona)
    
    try:
        # Intentamos guardar en la base de datos
        db.commit()
        db.refresh(_persona)
        return _persona
    except IntegrityError:
        # Si falla (ej: el DNI o Email ya existen), hacemos rollback para no romper la BD
        db.rollback()
        raise exceptions.DatoDuplicado()


def listar_personas(db: Session) -> List[Persona]:
    logger.info("Listando personal desde services")
    # Traemos todos los registros
    return db.scalars(select(Persona)).all()


def leer_persona(db: Session, persona_id: int) -> Persona:
    # Buscamos a la persona por ID
    db_persona = db.scalar(select(Persona).where(Persona.id == persona_id))
    if db_persona is None:
        raise exceptions.PersonaNoEncontrada()
    return db_persona


def modificar_persona(
    db: Session, persona_id: int, persona: schemas.PersonaUpdate
) -> Persona:
    # Primero verificamos que exista
    db_persona = leer_persona(db, persona_id)
    
    # exclude_unset=True hace que solo se actualicen los campos que el frontend realmente envió
    datos_a_actualizar = persona.model_dump(exclude_unset=True)
    
    if datos_a_actualizar:
        try:
            db.execute(
                update(Persona).where(Persona.id == persona_id).values(**datos_a_actualizar)
            )
            db.commit()
            db.refresh(db_persona)
        except IntegrityError:
            db.rollback()
            raise exceptions.DatoDuplicado()
            
    return db_persona


def eliminar_persona(db: Session, persona_id: int) -> Persona:
    # Buscamos a la persona
    db_persona = leer_persona(db, persona_id)
    
    # BAJA LÓGICA: En vez de borrarla de la BD, le cambiamos el estado a inactivo
    db_persona.activo = False
    db.commit()
    db.refresh(db_persona)
    
    return db_persona