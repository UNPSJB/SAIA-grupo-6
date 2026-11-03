import logging
from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.common.listados import ColumnaOrden, filtro_busqueda, paginar_consulta
from src.common.persistence import (
    aplicar_cambios,
    baja_logica,
    es_violacion_unica,
    guardar,
    mapa_por_campo,
)
from src.common.texto import sin_tildes
from src.auth.roles import puede_administrar
from src.Equipo.models import Equipo, Calibracion
from src.PlanCalibracionMantenimiento import exceptions, models, schemas
from src.personal.models import Personal


logger = logging.getLogger(__name__)

# `dias_restantes = proxima_fecha_vencimiento - hoy`, así que ordenar por la
# fecha y por los días restantes es exactamente la misma secuencia. SQLite
# resuelve la suma de días con `julianday`; al migrar a Postgres esta
# expresión tiene que pasar a `fecha_ultima_intervencion + periodicidad_dias`.
_PROXIMO_VENCIMIENTO = (
    func.julianday(models.PlanCalibracionMantenimiento.fecha_ultima_intervencion)
    + models.PlanCalibracionMantenimiento.periodicidad_dias
)

# Claves del query string -> expresión de orden. `Equipo` entra por el JOIN de
# `_consulta_planes`; el desempate por `id` lo agrega `aplicar_orden`.
_ORDENES = {
    "equipo_asc": ColumnaOrden(
        (
            sin_tildes(Equipo.nombre),
            sin_tildes(models.PlanCalibracionMantenimiento.tipo),
        )
    ),
    "equipo_desc": ColumnaOrden(
        (
            sin_tildes(Equipo.nombre),
            sin_tildes(models.PlanCalibracionMantenimiento.tipo),
        ),
        descendente=True,
    ),
    "tipo_asc": ColumnaOrden(
        (
            sin_tildes(models.PlanCalibracionMantenimiento.tipo),
            sin_tildes(Equipo.nombre),
        )
    ),
    "tipo_desc": ColumnaOrden(
        (
            sin_tildes(models.PlanCalibracionMantenimiento.tipo),
            sin_tildes(Equipo.nombre),
        ),
        descendente=True,
    ),
    "intervencion_asc": ColumnaOrden(
        (models.PlanCalibracionMantenimiento.fecha_ultima_intervencion,)
    ),
    "intervencion_desc": ColumnaOrden(
        (models.PlanCalibracionMantenimiento.fecha_ultima_intervencion,),
        descendente=True,
    ),
    "periodicidad_asc": ColumnaOrden(
        (models.PlanCalibracionMantenimiento.periodicidad_dias,)
    ),
    "periodicidad_desc": ColumnaOrden(
        (models.PlanCalibracionMantenimiento.periodicidad_dias,),
        descendente=True,
    ),
    # Ascendente deja primero los vencidos y después los que vencen antes;
    # descendente, los que más falta.
    "vencimiento_asc": ColumnaOrden((_PROXIMO_VENCIMIENTO,)),
    "vencimiento_desc": ColumnaOrden((_PROXIMO_VENCIMIENTO,), descendente=True),
}

_MAPEA_CONFLICTO_UNICO = mapa_por_campo(
    por_defecto=exceptions.PlanActivoDuplicado,
)


def _mapear_conflicto_plan_limpieza(mensaje: str) -> Exception:
    """Solo una violación UNIQUE es un duplicado. Cualquier otro
    IntegrityError (NOT NULL, FK rota) se propaga como error genérico (500)
    y queda logueado."""
    if not es_violacion_unica(mensaje):
        logger.error(
            "IntegrityError no-UNIQUE en plan de limpieza (no es un duplicado): %s",
            mensaje,
        )
        raise IntegrityError("sin mapear", {}, Exception(mensaje))
    return _MAPEA_CONFLICTO_UNICO(mensaje)


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
    return guardar(db, nuevo_plan, _mapear_conflicto_plan_limpieza)


def dar_de_baja_plan_calibracion_mantenimiento(
    db: Session, plan_id: int
) -> models.PlanCalibracionMantenimiento:
    """Baja lógica. Reutiliza el helper compartido en vez de repetir el
    `activo = False; commit; refresh` que estaba copiado en cada modulo."""
    return baja_logica(db, leer_plan_calibracion_mantenimiento(db, plan_id))


def _consulta_planes(
    incluir_inactivos: bool,
    buscar: Optional[str],
    tipo: Optional[str],
    equipo_id: Optional[int],
    solo_inactivos: bool = False,
):
    """Consulta base compartida por el listado completo y el paginado.

    El JOIN con `Equipo` (1:1 por PK) permite buscar y ordenar por el nombre
    del equipo sin una subconsulta por fila.
    """
    consulta = select(models.PlanCalibracionMantenimiento).join(
        Equipo, Equipo.id == models.PlanCalibracionMantenimiento.equipo_id
    )

    filtros = [
        filtro
        for filtro in (
            filtro_busqueda(
                (
                    Equipo.nombre,
                    models.PlanCalibracionMantenimiento.tipo,
                ),
                buscar,
            ),
            models.PlanCalibracionMantenimiento.tipo == tipo if tipo else None,
            models.PlanCalibracionMantenimiento.equipo_id == equipo_id
            if equipo_id
            else None,
        )
        if filtro is not None
    ]
    if filtros:
        consulta = consulta.where(*filtros)

    if solo_inactivos:
        consulta = consulta.where(models.PlanCalibracionMantenimiento.activo.is_(False))
    elif not incluir_inactivos:
        consulta = consulta.where(models.PlanCalibracionMantenimiento.activo.is_(True))

    return consulta


def listar_planes_calibracion_mantenimiento(
    db: Session,
    incluir_inactivos: bool = False,
    buscar: Optional[str] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
) -> list[models.PlanCalibracionMantenimiento]:
    logger.info(
        "Listando planes de calibración y mantenimiento "
        "(incluir_inactivos=%s)",
        incluir_inactivos,
    )
    consulta = _consulta_planes(
        incluir_inactivos, buscar, tipo, equipo_id
    ).order_by(models.PlanCalibracionMantenimiento.id)
    return list(db.scalars(consulta).all())


def listar_planes_calibracion_mantenimiento_paginado(
    db: Session,
    incluir_inactivos: bool,
    page: int,
    page_size: int,
    buscar: Optional[str] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    orden: str = "vencimiento_asc",
    solo_inactivos: bool = False,
) -> tuple[list[models.PlanCalibracionMantenimiento], int]:
    """Mismo filtro que `listar_planes_calibracion_mantenimiento`, recortado en la base."""
    logger.info(
        "Listando planes de calibración y mantenimiento paginado "
        "(incluir_inactivos=%s, page=%s)",
        incluir_inactivos,
        page,
    )
    return paginar_consulta(
        db,
        _consulta_planes(incluir_inactivos, buscar, tipo, equipo_id, solo_inactivos=solo_inactivos),
        modelo=models.PlanCalibracionMantenimiento,
        orden=orden,
        ordenes=_ORDENES,
        por_defecto="vencimiento_asc",
        page=page,
        page_size=page_size,
    )


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
    if "equipo_id" in cambios or "tipo" in cambios or cambios.get("activo") is True:
        _verificar_plan_activo_duplicado(db, equipo_id, tipo, plan.id)

    return aplicar_cambios(db, plan, cambios, _mapear_conflicto_plan_limpieza)


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


def recalcular_ultima_intervencion(
    db: Session, equipo_id: int, tipo: str
) -> None:
    """Recalcula `fecha_ultima_intervencion` del plan activo como el máximo
    `fecha_realizacion` entre las calibraciones activas del equipo/tipo.

    Se invoca al editar o dar de baja una intervención, para que el plan
    quede coherente con los registros que realmente quedan. A diferencia de
    `asentar_ultima_intervencion` (que solo avanza), acá sí puede retroceder
    al siguiente registro vigente cuando la intervención más reciente se
    edita a una fecha anterior o se da de baja. Si no quedan registros
    activos, se deja la fecha asentada (la columna es NOT NULL).
    No hace commit: comparte la transacción del caller.
    """
    db.flush()
    plan = db.scalar(
        select(models.PlanCalibracionMantenimiento).where(
            models.PlanCalibracionMantenimiento.equipo_id == equipo_id,
            models.PlanCalibracionMantenimiento.tipo == tipo,
            models.PlanCalibracionMantenimiento.activo.is_(True),
        )
    )
    if plan is None:
        return

    ultima = db.scalar(
        select(func.max(Calibracion.fecha_realizacion)).where(
            Calibracion.equipo_id == equipo_id,
            Calibracion.tipo == tipo,
            Calibracion.activo.is_(True),
        )
    )

    if ultima is not None:
        plan.fecha_ultima_intervencion = ultima
        db.add(plan)
