import logging
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.tareas import models, schemas, exceptions

# logger para este módulo específico
logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA TAREA
# ==========================================


def _verificar_plan_existe(db: Session, plan_limpieza_id: int) -> None:
    """Verifica que el plan de limpieza al que se quiere asociar la tarea exista.

    Se importa PlanLimpieza acá adentro (y no arriba del archivo) para evitar
    un import circular con src.PlanLimpieza.services, que sí importa
    src.tareas.models a nivel de módulo.
    """
    from src.PlanLimpieza.models import PlanLimpieza

    existe = db.scalar(
        select(PlanLimpieza).where(PlanLimpieza.id == plan_limpieza_id)
    )
    if existe is None:
        raise exceptions.PlanLimpiezaNoEncontrado()


def crear_tarea(db: Session, tarea: schemas.TareaCreate) -> models.Tarea:
    """Agrega una tarea suelta a un plan de limpieza ya existente.
    Para crear varias tareas junto con el plan, ver PlanLimpieza.services.crear_plan_limpieza."""
    _verificar_plan_existe(db, tarea.plan_limpieza_id)

    _tarea = models.Tarea(**tarea.model_dump())
    db.add(_tarea)

    try:
        db.commit()
        db.refresh(_tarea)
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear tarea: {e}")
        raise exceptions.DatoDuplicado()

    return _tarea


def listar_tareas(
    db: Session, plan_limpieza_id: Optional[int] = None
) -> List[models.Tarea]:
    logger.info("Listando tareas activas desde services")
    # traigo solo las tareas activas, opcionalmente filtradas por plan
    stmt = select(models.Tarea).where(models.Tarea.activo == True)
    if plan_limpieza_id is not None:
        stmt = stmt.where(models.Tarea.plan_limpieza_id == plan_limpieza_id)
    return db.scalars(stmt).all()


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
    # DEL MISMO PLAN (dos planes distintos sí pueden tener una tarea "Limpiar" cada uno)
    if "nombre" in datos_a_actualizar:
        existente = db.scalar(
            select(models.Tarea).where(
                models.Tarea.nombre == datos_a_actualizar["nombre"],
                models.Tarea.plan_limpieza_id == db_tarea.plan_limpieza_id,
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
