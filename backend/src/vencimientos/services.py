from datetime import date
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.aptitud.models import Aptitud
from src.Equipo.models import Equipo
from src.notificaciones.services import (
    MARGEN_DIAS_ALERTA,
    obtener_dias_alerta_vencimiento_personal,
)
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.vencimientos.schemas import VencimientoConsolidadoResponse
from src.vencimientoPersonal.models import VencimientoPersonal

# Orden de urgencia: primero los vencidos, después los próximos, al final los vigentes.
_ORDEN_ESTADO = {"VENCIDO": 0, "PROXIMO": 1, "VIGENTE": 2}


def _estado(dias_restantes: int, margen: int) -> str:
    # Mismo criterio que las notificaciones: hoy o antes ya cuenta como vencido.
    if dias_restantes <= 0:
        return "VENCIDO"
    if dias_restantes <= margen:
        return "PROXIMO"
    return "VIGENTE"


def _nombre_persona(persona: Personal) -> str:
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _vencimientos_personal(db: Session) -> List[VencimientoConsolidadoResponse]:
    hoy = date.today()
    margen = obtener_dias_alerta_vencimiento_personal(db)

    vencimientos = db.scalars(
        select(VencimientoPersonal)
        .join(Personal, VencimientoPersonal.persona_id == Personal.id)
        .join(Aptitud, VencimientoPersonal.aptitud_id == Aptitud.id)
        .options(
            selectinload(VencimientoPersonal.persona),
            selectinload(VencimientoPersonal.aptitud),
        )
        .where(
            VencimientoPersonal.activo.is_(True),
            Personal.activo.is_(True),
            Aptitud.activo.is_(True),
        )
    ).all()

    resultado = []
    for venc in vencimientos:
        dias = (venc.fecha_vencimiento - hoy).days
        resultado.append(
            VencimientoConsolidadoResponse(
                id_vencimiento=f"personal-{venc.id}",
                tipo="PERSONAL",
                entidad_id=venc.id,
                sujeto_id=venc.persona_id,
                detalle=venc.aptitud.nombre,
                sujeto=_nombre_persona(venc.persona),
                fecha_vencimiento=venc.fecha_vencimiento,
                dias_restantes=dias,
                estado=_estado(dias, margen),
                link_destino=f"/personal/detalle/{venc.persona_id}",
            )
        )
    return resultado


def _vencimientos_equipos(
    db: Session, tipo: Optional[str]
) -> List[VencimientoConsolidadoResponse]:
    consulta = (
        select(PlanCalibracionMantenimiento)
        .join(Equipo)
        .options(selectinload(PlanCalibracionMantenimiento.equipo))
        .where(
            PlanCalibracionMantenimiento.activo.is_(True),
            Equipo.activo.is_(True),
        )
    )
    # En la base el tipo se guarda en minúscula: "calibracion" / "mantenimiento".
    if tipo:
        consulta = consulta.where(PlanCalibracionMantenimiento.tipo == tipo.lower())

    resultado = []
    for plan in db.scalars(consulta).all():
        dias = plan.dias_restantes
        es_calibracion = plan.tipo == "calibracion"
        resultado.append(
            VencimientoConsolidadoResponse(
                id_vencimiento=f"plan-{plan.id}",
                tipo="CALIBRACION" if es_calibracion else "MANTENIMIENTO",
                entidad_id=plan.id,
                sujeto_id=plan.equipo.id,
                detalle="Calibración" if es_calibracion else "Mantenimiento",
                sujeto=plan.equipo.nombre,
                fecha_vencimiento=plan.proxima_fecha_vencimiento,
                dias_restantes=dias,
                estado=_estado(dias, MARGEN_DIAS_ALERTA),
                link_destino=f"/planes-calibracion-mantenimiento/{plan.id}/editar",
            )
        )
    return resultado


def listar_vencimientos(
    db: Session, tipo: Optional[str] = None
) -> List[VencimientoConsolidadoResponse]:
    """Junta todas las fuentes de vencimientos en una sola lista ordenada por urgencia.

    Para sumar una fuente nueva (por ejemplo documentos, cuando tengan fecha de
    vencimiento) alcanza con escribir otra función como las de arriba y agregarla acá.
    """
    items: List[VencimientoConsolidadoResponse] = []

    if tipo in (None, "PERSONAL"):
        items.extend(_vencimientos_personal(db))
    if tipo in (None, "CALIBRACION", "MANTENIMIENTO"):
        items.extend(_vencimientos_equipos(db, tipo))

    # Primero por estado y, dentro de cada estado, el más urgente (menos días) arriba.
    items.sort(key=lambda v: (_ORDEN_ESTADO[v.estado], v.dias_restantes))
    return items