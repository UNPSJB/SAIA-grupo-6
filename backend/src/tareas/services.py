import logging
from typing import List

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.tareas import models, schemas, exceptions

# logger para este módulo específico
logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA TAREA
# ==========================================


def crear_tarea(db: Session, tarea: schemas.TareaCreate) -> models.Tarea:
    _tarea = models.Tarea(**tarea.model_dump())
    db.add(_tarea)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear tarea: {e}")
        #FALTAN EXCEPCIONES ESPECIFICAS PARA LOS ERRORES



    return _tarea


def listar_tareas(db: Session) -> List[models.Tarea]:
    logger.info("Listando tareas activas desde services")
    # traigo solo las tareas activas
    return db.scalars(
        select(models.Tarea).where(models.Tarea.activo == True)
    ).all()


def leer_tarea(db: Session, tarea_id: int) -> models.Tarea:
    db_tarea = db.scalar(select(models.Tarea).where(models.Tarea.id == tarea_id))
    if db_tarea is None:
        raise exceptions.TareaNoEncontrada()
    return db_tarea


def modificar_tarea(
    db: Session, tarea_id: int, tarea: schemas.TareaUpdate
) -> models.Tarea:
    db_tarea = leer_tarea(db, tarea_id)

    datos_a_actualizar = tarea.model_dump(exclude_unset=True)

    # si se está cambiando el nombre, verifico que no choque con otra tarea
    if "nombre" in datos_a_actualizar:
        existente = db.scalar(
            select(models.Tarea).where(
                models.Tarea.nombre == datos_a_actualizar["nombre"],
                models.Tarea.id != tarea_id,
            )
        )
        if existente:
            raise exceptions.NombreDuplicado()

    if datos_a_actualizar:
        db.execute(
            update(models.Tarea)
            .where(models.Tarea.id == tarea_id)
            .values(**datos_a_actualizar)
        )
        db.commit()
        db.refresh(db_tarea)

    return db_tarea


def eliminar_tarea(db: Session, tarea_id: int) -> models.Tarea:
    db_tarea = leer_tarea(db, tarea_id)

    # BAJA LÓGICA: en vez de borrar de la bd, cambio el estado a inactivo
    db_tarea.activo = False
    db.commit()
    db.refresh(db_tarea)

    return db_tarea
