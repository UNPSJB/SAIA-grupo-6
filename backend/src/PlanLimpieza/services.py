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
    """Instancia las tareas nuevas y propias del plan (composición, no M2M).
    Cada tarea trae su propia frecuencia."""
    return [Tarea(nombre=t.nombre, frecuencia=t.frecuencia) for t in tareas]


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

    if "autor_id" in datos_a_actualizar:
        _verificar_autor_administrador(db, datos_a_actualizar["autor_id"])

    # Manejo seguro de tareas sin DELETE destructivo
    if "tareas" in datos_a_actualizar:
        tareas_input = datos_a_actualizar.pop("tareas")
        # nombre -> frecuencia de cada tarea que viene en la petición
        tareas_nuevas = {
            t["nombre"]: t["frecuencia"] for t in tareas_input if t.get("nombre")
        }

        # 1. Tareas existentes asociadas a este plan
        tareas_actuales = {t.nombre: t for t in db_plan.tareas}

        # 2. Desactivar tareas que se eliminaron del plan en lugar de borrarlas con DELETE
        for t in db_plan.tareas:
            if t.nombre not in tareas_nuevas:
                t.activo = False

        # 3. Agregar o reactivar las que vienen en la petición, actualizando su frecuencia
        for nombre, frecuencia in tareas_nuevas.items():
            if nombre in tareas_actuales:
                tareas_actuales[nombre].activo = True
                tareas_actuales[nombre].frecuencia = frecuencia
            else:
                db_plan.tareas.append(Tarea(nombre=nombre, frecuencia=frecuencia))

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
