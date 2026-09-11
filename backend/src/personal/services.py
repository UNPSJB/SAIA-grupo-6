import logging
from typing import List
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.personal.models import Persona
from src.personal import schemas, exceptions
from fastapi import HTTPException

#logger para este módulo específico. 
logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA PERSONAL
# ==========================================

def crear_persona(db: Session, persona: schemas.PersonaCreate) -> Persona:
    # transformo el schema de Pydantic a un modelo de SQLAlchemy
    _persona = Persona(**persona.model_dump())
    db.add(_persona)
    
    try:
        # guardo la nueva persona en la base de datos
        db.commit()
        db.refresh(_persona)
        return _persona
    except IntegrityError as e:
        # si falla el dni o email pq ya existe, TENGO QUE hacer rollback para no romper la bd
        db.rollback()
        
        # leo el error original de la bd
        mensaje_error = str(e.orig).lower()
        
        # depende si el error menciona al dni o al email, tiro el texto
        if "dni" in mensaje_error:
            raise HTTPException(status_code=400, detail="⚠️ El DNI ingresado ya se encuentra registrado para otra persona.")
        elif "email" in mensaje_error:
            raise HTTPException(status_code=400, detail="⚠️ El correo electrónico ingresado ya está en uso.")
        else:
            raise exceptions.DatoDuplicado()


def listar_personas(db: Session) -> List[Persona]:
    logger.info("Listando personal desde services")
    # traigo TODOS los registros
    return db.scalars(select(Persona).where(Persona.activo == True)).all()


def leer_persona(db: Session, persona_id: int) -> Persona:
    # buesco a la persona por id
    db_persona = db.scalar(select(Persona).where(Persona.id == persona_id))
    if db_persona is None:
        raise exceptions.PersonaNoEncontrada()
    return db_persona


def modificar_persona(
    db: Session, persona_id: int, persona: schemas.PersonaUpdate
) -> Persona:
    # primero tengo q verificar que exista lol
    db_persona = leer_persona(db, persona_id)
    
    # exclude_unset=True hace q solo se actualicen los campos que el frontend realmente envió
    datos_a_actualizar = persona.model_dump(exclude_unset=True)
    
    if datos_a_actualizar:
        try:
            db.execute(
                update(Persona).where(Persona.id == persona_id).values(**datos_a_actualizar)
            )
            db.commit()
            db.refresh(db_persona)
        except IntegrityError as e:
            # hago el rollback para no romper la bd
            db.rollback()
            
            # leo el error original de la bd
            mensaje_error = str(e.orig).lower()
            
            if "dni" in mensaje_error:
                raise HTTPException(status_code=400, detail="⚠️ El DNI ingresado ya se encuentra registrado para otra persona.")
            elif "email" in mensaje_error:
                raise HTTPException(status_code=400, detail="⚠️ El correo electrónico ingresado ya está en uso.")
            else:
                raise exceptions.DatoDuplicado()
            
    return db_persona


def eliminar_persona(db: Session, persona_id: int) -> Persona:
    # busco
    db_persona = leer_persona(db, persona_id)
    
    # BAJA LÓGICA: en vez de borrarla de la bd, le cambio el estado a inactivo
    db_persona.activo = False
    db.commit()
    db.refresh(db_persona)
    
    return db_persona