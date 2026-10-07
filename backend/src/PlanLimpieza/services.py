import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.auth.roles import puede_administrar
from src.common.persistence import aplicar_cambios, mapa_por_campo
from src.PlanLimpieza import models, schemas, exceptions
from src.personal.models import Personal
from src.tareas.models import Tarea
from src.tareas.schemas import TareaBase as TareaInput

# logger para este módulo específico
logger = logging.getLogger(__name__)

# `plan_limpieza.nombre` es UNIQUE. El pre-chequeo no existia en este modulo,
# asi que un PUT con nombre repetido llegaba hasta el commit.
_MAPEA_CONFLICTO = mapa_por_campo(
    ("plan_limpieza.nombre", exceptions.NombrePlanDuplicado),
    por_defecto=exceptions.DatoDuplicado,
)

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

    if not puede_administrar(db_autor):
        raise exceptions.AutorSinPermisoDeAdministrar()

    return db_autor


def _crear_tareas_del_plan(tareas: List[TareaInput]) -> List[Tarea]:
    """Instancia las tareas nuevas y propias del plan (composición, no M2M).
    Cada tarea trae su propia frecuencia y su procedimiento."""
    return [
        Tarea(nombre=t.nombre, frecuencia=t.frecuencia, descripcion=t.descripcion)
        for t in tareas
    ]


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


def listar_planes_limpieza(
    db: Session, incluir_inactivos: bool = False
) -> List[models.PlanLimpieza]:
    logger.info(
        "Listando planes de limpieza (incluir_inactivos=%s)", incluir_inactivos
    )
    query = select(models.PlanLimpieza)
    if not incluir_inactivos:
        query = query.where(models.PlanLimpieza.activo == True)
    return db.scalars(query).all()


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

    # Manejo seguro de tareas sin DELETE destructivo.
    # Se matchea por id (no por nombre): así renombrar una tarea actualiza
    # la fila existente en vez de desactivarla y crear una tarea nueva.
    if "tareas" in datos_a_actualizar:
        tareas_input = datos_a_actualizar.pop("tareas")

        tareas_actuales_por_id = {t.id: t for t in db_plan.tareas}
        ids_recibidos = {
            t["id"] for t in tareas_input if t.get("id") is not None
        }

        # 1. Desactivar las tareas existentes que ya no vinieron en la petición
        for tarea in db_plan.tareas:
            if tarea.id not in ids_recibidos:
                tarea.activo = False

        # 2. Actualizar (por id) o crear (sin id) cada tarea recibida
        for t in tareas_input:
            tarea_id = t.get("id")
            if tarea_id is not None and tarea_id in tareas_actuales_por_id:
                tarea = tareas_actuales_por_id[tarea_id]
                tarea.nombre = t["nombre"]
                tarea.frecuencia = t["frecuencia"]
                tarea.descripcion = t.get("descripcion")
                tarea.activo = True
            else:
                db_plan.tareas.append(
                    Tarea(
                        nombre=t["nombre"],
                        frecuencia=t["frecuencia"],
                        descripcion=t.get("descripcion"),
                    )
                )

    return aplicar_cambios(db, db_plan, datos_a_actualizar, _MAPEA_CONFLICTO)


def eliminar_plan_limpieza(db: Session, plan_id: int) -> models.PlanLimpieza:
    # busco
    db_plan = leer_plan_limpieza(db, plan_id)

    # BAJA LÓGICA: en vez de borrar de la bd, cambio el estado a inactivo
    db_plan.activo = False
    db.commit()
    db.refresh(db_plan)

    return db_plan
