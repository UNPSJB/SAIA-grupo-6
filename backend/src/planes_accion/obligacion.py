"""Plan de acción obligatorio al cerrar un incidente.

Un incidente que exige plan (porque el administrador marcó su tipo, o porque
su elemento está en riesgo alto) no se puede cerrar mientras no esté en un
plan: cerrarlo haría desaparecer la situación sin que nadie la haya tratado.

Lo usa `incidente.services.cerrar_incidente`, el único camino de cierre (también
el de reclamos, retiros y rechazos). No hace commit ni recalcula notificaciones:
se llama en medio de la transacción del cierre.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.exceptions import BadRequest
from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo
from src.planes_accion.constants import ErrorCode


def _exige_por_tipo(db: Session, incidente) -> bool:
    """El tipo del incidente (con su causa, si es de circuito) exige plan según
    la configuración vigente. Se calcula en el momento: no depende de que la
    tabla de notificaciones esté al día."""
    from src.notificaciones.criticidad import _tipos_de_riesgo
    from src.notificaciones.impacto import configuracion_vigente

    configuracion = configuracion_vigente(db)
    tipo, _ = _tipos_de_riesgo(db, [incidente], configuracion)[incidente.id]
    return tipo is not None and configuracion[tipo].plan_obligatorio


def _exige_por_elemento(db: Session, clave: str) -> bool:
    """La última evaluación del motor marcó que su elemento está en riesgo alto
    sin plan suficiente."""
    motivo = db.scalar(
        select(NotificacionPersistida.motivo_plan).where(
            NotificacionPersistida.id_notificacion == clave
        )
    )
    return motivo == "elemento"


def _cubierta(db: Session, clave: str) -> bool:
    """Está en un plan activo o un plan verificado la controla."""
    from src.planes_accion.mitigacion import cobertura_activa, situaciones_controladas

    ids = set(
        db.scalars(
            select(SituacionRiesgo.id).where(
                SituacionRiesgo.clave == clave, SituacionRiesgo.resuelta_en.is_(None)
            )
        )
    )
    if not ids:
        return False
    por_situacion, _ = cobertura_activa(db)
    controladas = situaciones_controladas(db)
    return any(i in por_situacion or i in controladas for i in ids)


#: Marca de sesión para cargar HISTORIA (los scripts de datos de prueba): un
#: retiro o reclamo cerrado hace meses es anterior a la regla. No hay forma de
#: activarla desde la API.
OMITIR_EN_SESION = "omitir_plan_obligatorio"


def exigir_plan_al_cerrar(db: Session, incidente) -> None:
    """Corta el cierre si el incidente exige un plan y todavía no lo tiene."""
    if db.info.get(OMITIR_EN_SESION):
        return
    clave = f"incidente-{incidente.id}"
    if not (_exige_por_tipo(db, incidente) or _exige_por_elemento(db, clave)):
        return
    if _cubierta(db, clave):
        return
    raise BadRequest(ErrorCode.PLAN_OBLIGATORIO_PENDIENTE)
