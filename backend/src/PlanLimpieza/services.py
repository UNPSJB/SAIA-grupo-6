import logging
from typing import List

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.PlanLimpieza import models, schemas, exceptions
from src.personal.models import Personal
from src.tareas.models import Tarea
from src.tareas.schemas import TareaBase as TareaInput

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


def _crear_tareas_del_plan(tareas: List[TareaInput]) -> List[Tarea]:
    """Instancia las tareas nuevas y propias del plan (composición, no M2M)."""
    return [Tarea(nombre=t.nombre) for t in tareas]


def crear_plan_limpieza(
    db: Session, plan: schemas.PlanLimpiezaCreate
) -> models.PlanLimpieza:
    _verificar_autor_administrador(db, plan.autor_id)

    datos_plan = plan.model_dump(exclude={"tareas"})
    _plan = models.PlanLimpieza(**datos_plan)
    _plan.tareas = _crear_tareas_del_plan(plan.tareas)
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

    # las tareas se manejan aparte: no son una columna sino una lista de
    # entidades hijas propias del plan (relación 1-N, no un M2M), así que no
    # pueden ir dentro del update() masivo. Se reemplaza la lista completa;
    # gracias a cascade="all, delete-orphan" las tareas viejas se eliminan solas.
    nuevas_tareas = None
    if "tareas" in datos_a_actualizar:
        nuevas_tareas = _crear_tareas_del_plan(
            [TareaInput(**t) for t in datos_a_actualizar.pop("tareas")]
        )

    if datos_a_actualizar:
        try:
            db.execute(
                update(models.PlanLimpieza)
                .where(models.PlanLimpieza.id == plan_id)
                .values(**datos_a_actualizar)
            )

        except IntegrityError as e:
            db.rollback()
            mensaje_error = str(e.orig).lower()
            if "nombre" in mensaje_error:
                raise exceptions.NombrePlanDuplicado()
            else:
                raise exceptions.DatoDuplicado()

    if nuevas_tareas is not None:
        db_plan.tareas = nuevas_tareas

    db.commit()
    db.refresh(db_plan)

    return db_plan


def eliminar_plan_limpieza(db: Session, plan_id: int) -> models.PlanLimpieza:
    # busco
    db_plan = leer_plan_limpieza(db, plan_id)

    # BAJA LÓGICA: en vez de borrar de la bd, cambio el estado a inactivo
    db_plan.activo = False
    db.commit()
    db.refresh(db_plan)

    return db_plan
