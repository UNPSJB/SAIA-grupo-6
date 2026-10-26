import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    guardar,
    mapa_por_campo,
)
from src.common.paginacion import paginar
from src.auth.roles import puede_administrar
from src.Equipo.models import Equipo
from src.PlanCalibracionMantenimiento import exceptions, models, schemas
from src.personal.models import Personal


logger = logging.getLogger(__name__)

_MAPEA_CONFLICTO = mapa_por_campo(
    por_defecto=exceptions.PlanActivoDuplicado,
)


def _verificar_equipo_activo(db: Session, equipo_id: int) -> Equipo:
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))

    if equipo is None:
        raise exceptions.EquipoNoEncontrado()
    if not equipo.activo:
        raise exceptions.EquipoInactivo()

    return equipo


def _verificar_autor_administrador(db: Session, autor_id: int) -> Personal:
    autor = db.scalar(select(Personal).where(Personal.id == autor_id))

    if autor is None:
        raise exceptions.AutorNoEncontrado()
    if not autor.activo:
        raise exceptions.AutorInactivo()
    if not puede_administrar(autor):
        raise exceptions.AutorSinPermisoDeAdministrar()

    return autor


def _verificar_plan_activo_duplicado(
    db: Session, equipo_id: int, tipo: str, plan_id: int | None = None
) -> None:
    query = select(models.PlanCalibracionMantenimiento).where(
        models.PlanCalibracionMantenimiento.equipo_id == equipo_id,
        models.PlanCalibracionMantenimiento.tipo == tipo,
        models.PlanCalibracionMantenimiento.activo.is_(True),
    )
    if plan_id is not None:
        query = query.where(models.PlanCalibracionMantenimiento.id != plan_id)

    if db.scalar(query) is not None:
        raise exceptions.PlanActivoDuplicado()


def crear_plan_calibracion_mantenimiento(
    db: Session, plan: schemas.PlanCalibracionMantenimientoCreate, autor_id: int
) -> models.PlanCalibracionMantenimiento:
    _verificar_equipo_activo(db, plan.equipo_id)
    _verificar_autor_administrador(db, autor_id)
    _verificar_plan_activo_duplicado(db, plan.equipo_id, plan.tipo)

    nuevo_plan = models.PlanCalibracionMantenimiento(
        **plan.model_dump(), autor_id=autor_id
    )
    db.add(nuevo_plan)
    return guardar(db, nuevo_plan, _MAPEA_CONFLICTO)


def dar_de_baja_plan_calibracion_mantenimiento(
    db: Session, plan_id: int
) -> models.PlanCalibracionMantenimiento:
    """Baja lógica. Reutiliza el helper compartido en vez de repetir el
    `activo = False; commit; refresh` que estaba copiado en cada modulo."""
    return baja_logica(db, leer_plan_calibracion_mantenimiento(db, plan_id))


def listar_planes_calibracion_mantenimiento(
    db: Session, incluir_inactivos: bool = False
) -> list[models.PlanCalibracionMantenimiento]:
    logger.info(
        "Listando planes de calibración y mantenimiento "
        "(incluir_inactivos=%s)",
        incluir_inactivos,
    )
    query = select(models.PlanCalibracionMantenimiento).order_by(
        models.PlanCalibracionMantenimiento.id
    )
    if not incluir_inactivos:
        query = query.where(models.PlanCalibracionMantenimiento.activo.is_(True))
    return list(db.scalars(query).all())


def listar_planes_calibracion_mantenimiento_paginado(
    db: Session, incluir_inactivos: bool, page: int, page_size: int
) -> tuple[list[models.PlanCalibracionMantenimiento], int]:
    """Mismo filtro que `listar_planes_calibracion_mantenimiento`, recortado en la base."""
    logger.info(
        "Listando planes de calibración y mantenimiento paginado "
        "(incluir_inactivos=%s, page=%s)",
        incluir_inactivos,
        page,
    )
    query = select(models.PlanCalibracionMantenimiento).order_by(
        models.PlanCalibracionMantenimiento.id
    )
    if not incluir_inactivos:
        query = query.where(models.PlanCalibracionMantenimiento.activo.is_(True))
    return paginar(db, query, page, page_size)


def leer_plan_calibracion_mantenimiento(
    db: Session, plan_id: int
) -> models.PlanCalibracionMantenimiento:
    plan = db.get(models.PlanCalibracionMantenimiento, plan_id)
    if plan is None:
        raise exceptions.PlanCalibracionMantenimientoNoEncontrado()
    return plan


def modificar_plan_calibracion_mantenimiento(
    db: Session,
    plan_id: int,
    datos: schemas.PlanCalibracionMantenimientoUpdate,
) -> models.PlanCalibracionMantenimiento:
    plan = leer_plan_calibracion_mantenimiento(db, plan_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)

    equipo_id = cambios.get("equipo_id", plan.equipo_id)
    tipo = cambios.get("tipo", plan.tipo)

    if "equipo_id" in cambios:
        _verificar_equipo_activo(db, equipo_id)
    if "equipo_id" in cambios or "tipo" in cambios:
        _verificar_plan_activo_duplicado(db, equipo_id, tipo, plan.id)

    return aplicar_cambios(db, plan, cambios, _MAPEA_CONFLICTO)


def asentar_ultima_intervencion(
    db: Session, equipo_id: int, tipo: str, fecha_realizacion: date
) -> None:
    """Asienta una intervención registrada sobre su plan activo del mismo tipo.

    Reglas de negocio:
    - Solo toca planes `activo` cuyo `tipo` coincide con la intervención; el
      otro tipo de plan del equipo queda intacto.
    - Avanza `fecha_ultima_intervencion` con la fecha en que se realizó la
      intervención, no con la fecha de hoy.
    - Nunca atrasa la fecha: si el registro es más viejo que la última
      intervención ya asentada, se ignora.

    Por la validación de planes activos duplicados hay, como máximo, un plan
    activo por tipo y equipo; el bucle es defensivo. No hace commit: comparte
    la transacción con el alta de la intervención.
    """
    planes = db.scalars(
        select(models.PlanCalibracionMantenimiento).where(
            models.PlanCalibracionMantenimiento.equipo_id == equipo_id,
            models.PlanCalibracionMantenimiento.tipo == tipo,
            models.PlanCalibracionMantenimiento.activo.is_(True),
        )
    ).all()

    for plan in planes:
        if fecha_realizacion > plan.fecha_ultima_intervencion:
            plan.fecha_ultima_intervencion = fecha_realizacion
            db.add(plan)
