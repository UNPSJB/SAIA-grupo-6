import logging
from typing import List

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.PlanLimpieza import models, schemas, exceptions
from src.personal.models import Personal

# logger para este módulo específico
logger = logging.getLogger(__name__)

# ==========================================
# OPERACIONES CRUD PARA PLAN DE LIMPIEZA
# ==========================================

def _verificar_autor_administrador(db: Session, autor_id: int) -> Personal:
    """Verifica que el autor exista, esté activo y tenga permiso de administrar."""
    db_autor = db.scalar(select(Personal).where(Personal.id == autor_id))

    if db_autor is None:
        raise exceptions.AutorNoEncontrado()

    if not db_autor.activo:
        raise exceptions.AutorInactivo()

    if not db_autor.puede_administrar:
        raise exceptions.AutorSinPermisoDeAdministrar()

    return db_autor

def crear_plan_limpieza(
    db: Session, plan: schemas.PlanLimpiezaCreate
) -> models.PlanLimpieza:
    _verificar_autor_administrador(db, plan.autor_id)

    _plan = models.PlanLimpieza(**plan.model_dump())
    db.add(_plan)

    try:
        db.commit()
        db.refresh(_plan)
        return _plan

    except IntegrityError as e:
        db.rollback()
        mensaje_error = str(e.orig).lower()
        if "nombre" in mensaje_error:
            raise exceptions.NombrePlanDuplicado()
        elif "tarea_id" in mensaje_error and "equipo_id" in mensaje_error:
            raise exceptions.PlanDuplicado()
        else:
            raise exceptions.DatoDuplicado()


def listar_planes_limpieza(db: Session) -> List[models.PlanLimpieza]:
    logger.info("Listando planes de limpieza desde services")
    # traigo solo los planes activos
    return db.scalars(
        select(models.PlanLimpieza).where(models.PlanLimpieza.activo == True)
    ).all()


def leer_plan_limpieza(db: Session, plan_id: int) -> models.PlanLimpieza:
    # busco el plan por id
    db_plan = db.scalar(
        select(models.PlanLimpieza).where(models.PlanLimpieza.id == plan_id)
    )
    if db_plan is None:
        raise exceptions.PlanLimpiezaNoEncontrado()
    return db_plan


def modificar_plan_limpieza(
    db: Session, plan_id: int, plan: schemas.PlanLimpiezaUpdate
) -> models.PlanLimpieza:
    db_plan = leer_plan_limpieza(db, plan_id)

    datos_a_actualizar = plan.model_dump(exclude_unset=True)

    # si en esta edición se está cambiando el autor, valido el nuevo también
    if "autor_id" in datos_a_actualizar:
        _verificar_autor_administrador(db, datos_a_actualizar["autor_id"])

    if datos_a_actualizar:
        try:
            db.execute(
                update(models.PlanLimpieza)
                .where(models.PlanLimpieza.id == plan_id)
                .values(**datos_a_actualizar)
            )
            db.commit()
            db.refresh(db_plan)

        except IntegrityError as e:
            db.rollback()
            mensaje_error = str(e.orig).lower()
            if "tarea_id" in mensaje_error and "equipo_id" in mensaje_error:
                raise exceptions.PlanDuplicado()
            else:
                raise exceptions.DatoDuplicado()

    return db_plan


def eliminar_plan_limpieza(db: Session, plan_id: int) -> models.PlanLimpieza:
    # busco
    db_plan = leer_plan_limpieza(db, plan_id)

    # BAJA LÓGICA: en vez de borrar de la bd, cambio el estado a inactivo
    db_plan.activo = False
    db.commit()
    db.refresh(db_plan)

    return db_plan