import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.Equipo.models import Equipo
from src.PlanCalibracionMantenimiento import exceptions, models, schemas
from src.personal.models import Personal


logger = logging.getLogger(__name__)


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
    if not autor.puede_administrar:
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
    db: Session, plan: schemas.PlanCalibracionMantenimientoCreate
) -> models.PlanCalibracionMantenimiento:
    _verificar_equipo_activo(db, plan.equipo_id)
    _verificar_autor_administrador(db, plan.autor_id)
    _verificar_plan_activo_duplicado(db, plan.equipo_id, plan.tipo)

    nuevo_plan = models.PlanCalibracionMantenimiento(**plan.model_dump())
    db.add(nuevo_plan)
    db.commit()
    db.refresh(nuevo_plan)
    return nuevo_plan


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
    if "autor_id" in cambios:
        _verificar_autor_administrador(db, cambios["autor_id"])
    if "equipo_id" in cambios or "tipo" in cambios:
        _verificar_plan_activo_duplicado(db, equipo_id, tipo, plan.id)

    for atributo, valor in cambios.items():
        setattr(plan, atributo, valor)

    db.commit()
    db.refresh(plan)
    return plan
