import logging
from typing import Any, List, Optional

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.auth.roles import puede_administrar
from src.common.listados import ColumnaOrden, paginar_consulta
from src.common.persistence import aplicar_cambios, mapa_por_campo
from src.common.texto import contiene_texto, sin_tildes
from src.Equipo.models import Equipo
from src.PlanLimpieza import models, schemas, exceptions
from src.personal.models import Personal
from src.tareas.models import Tarea
from src.tareas.schemas import TareaBase as TareaInput

# Claves del query string -> expresión de orden. El nombre del equipo vive en
# otra tabla, así que el JOIN de `_consulta_planes` también sirve para ordenar.
_ORDENES = {
    "nombre_asc": ColumnaOrden((sin_tildes(models.PlanLimpieza.nombre),)),
    "nombre_desc": ColumnaOrden(
        (sin_tildes(models.PlanLimpieza.nombre),), descendente=True
    ),
    "equipo_asc": ColumnaOrden((sin_tildes(Equipo.nombre),)),
    "equipo_desc": ColumnaOrden((sin_tildes(Equipo.nombre),), descendente=True),
}

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
    Cada tarea trae su propia frecuencia, su procedimiento, su tipo
    (preoperacional/operacional/postoperacional) y sus observaciones."""
    return [
        Tarea(
            nombre=t.nombre,
            frecuencia=t.frecuencia,
            tipo=t.tipo,
            descripcion=t.descripcion,
            observaciones=t.observaciones,
        )
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


def _filtro_busqueda_planes(buscar: Optional[str]) -> Any | None:
    """Busca en el plan, su equipo y el nombre de sus tareas.

    Las tareas son una relación 1-N: un JOIN duplicaría el plan (una fila por
    tarea) y rompería el COUNT y el LIMIT. Por eso cada término se busca con
    un `EXISTS` correlacionado, y se exige que TODOS los términos aparezcan
    en alguno de los tres campos.
    """
    terminos = (buscar or "").split()
    if not terminos:
        return None

    return and_(
        *(
            or_(
                contiene_texto(models.PlanLimpieza.nombre, termino),
                contiene_texto(Equipo.nombre, termino),
                exists().where(
                    Tarea.plan_limpieza_id == models.PlanLimpieza.id,
                    contiene_texto(Tarea.nombre, termino),
                ),
            )
            for termino in terminos
        )
    )


def _consulta_planes(
    incluir_inactivos: bool,
    buscar: Optional[str],
    equipo_id: Optional[int],
):
    """Consulta base compartida por el listado completo y el paginado.

    El JOIN con `Equipo` es 1:1 (por PK), así que no duplica filas: sirve para
    buscar y ordenar por nombre de equipo sin subconsultas por fila.
    """
    consulta = (
        select(models.PlanLimpieza)
        .join(Equipo, Equipo.id == models.PlanLimpieza.equipo_id)
        # Las tareas se muestran en la tabla: una sola consulta extra por
        # página evita el N+1 al serializar cada plan.
        .options(selectinload(models.PlanLimpieza.tareas))
    )

    filtros = [
        filtro
        for filtro in (
            _filtro_busqueda_planes(buscar),
            models.PlanLimpieza.equipo_id == equipo_id if equipo_id else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if not incluir_inactivos:
        consulta = consulta.where(models.PlanLimpieza.activo.is_(True))

    return consulta


def listar_planes_limpieza(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    equipo_id: Optional[int] = None,
) -> List[models.PlanLimpieza]:
    logger.info(
        "Listando planes de limpieza (incluir_inactivos=%s)", incluir_inactivos
    )
    consulta = _consulta_planes(incluir_inactivos, buscar, equipo_id).order_by(
        models.PlanLimpieza.id
    )
    return list(db.scalars(consulta).all())


def listar_planes_limpieza_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    equipo_id: Optional[int] = None,
    orden: str = "nombre_asc",
) -> tuple[List[models.PlanLimpieza], int]:
    """Mismo filtro que `listar_planes_limpieza`, recortado en la base."""
    logger.info(
        "Listando planes de limpieza paginado (incluir_inactivos=%s, page=%s)",
        incluir_inactivos,
        page,
    )
    return paginar_consulta(
        db,
        _consulta_planes(incluir_inactivos, buscar, equipo_id),
        modelo=models.PlanLimpieza,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="nombre_asc",
        page=page,
        page_size=page_size,
    )


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
                tarea.tipo = t["tipo"]
                tarea.descripcion = t.get("descripcion")
                tarea.observaciones = t.get("observaciones")
                tarea.activo = True
            else:
                db_plan.tareas.append(
                    Tarea(
                        nombre=t["nombre"],
                        frecuencia=t["frecuencia"],
                        tipo=t["tipo"],
                        descripcion=t.get("descripcion"),
                        observaciones=t.get("observaciones"),
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
