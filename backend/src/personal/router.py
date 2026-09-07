import logging
from typing import List 
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.database import get_db
from src.personal import schemas, services

# Creamos un logger para este módulo específico
logger = logging.getLogger(__name__)

# Agrupamos las rutas bajo el prefijo /personal
router = APIRouter(prefix="/personal", tags=["personal"])

@router.post("/", response_model=schemas.Persona)
def create_persona(persona: schemas.PersonaCreate, db: Session = Depends(get_db)):
    return services.crear_persona(db, persona)

@router.get("/", response_model=List[schemas.Persona])
def read_personas(db: Session = Depends(get_db)):
    logger.info("Consultando la lista de personal activo")
    return services.listar_personas(db)

@router.get("/{persona_id}", response_model=schemas.Persona)
def read_persona(persona_id: int, db: Session = Depends(get_db)):
    return services.leer_persona(db, persona_id)

@router.put("/{persona_id}", response_model=schemas.Persona)
def update_persona(persona_id: int, persona: schemas.PersonaUpdate, db: Session = Depends(get_db)):
    return services.modificar_persona(db, persona_id, persona)

@router.delete("/{persona_id}", response_model=schemas.Persona)
def delete_persona(persona_id: int, db: Session = Depends(get_db)):
    return services.eliminar_persona(db, persona_id)