"""Ficha del incidente: el registro más todo lo que lo rodea.

Va aparte de `services` porque necesita los módulos de salidas, reclamos y
retiros, y esos ya importan `incidente.services` para abrir sus incidentes: en
el mismo archivo el import sería circular.
"""

from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.Equipo.models import Equipo
from src.incidente import schemas, services
from src.incidente.constants import TipoIncidente
from src.incidente.models import Incidente
from src.lotes.models import LoteProducto
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.reclamos.models import Reclamo
from src.reclamos.services import reclamo_a_resumen
from src.reposiciones.models import Reposicion
from src.retiros.models import Retiro
from src.retiros.services import retiro_a_resumen
from src.salidas.models import Salida
from src.salidas.services import salida_a_resumen

# Cuántos incidentes relacionados se listan en la ficha.
MAXIMO_RELACIONADOS = 5


def obtener_detalle(
    db: Session, incidente_id: int, current_user: Personal
) -> schemas.IncidenteDetalleResponse:
    """Arma la ficha. El permiso lo resuelve `obtener_incidente`."""
    incidente = services.obtener_incidente(db, incidente_id, current_user)
    reclamo = db.scalar(select(Reclamo).where(Reclamo.incidente_id == incidente.id))
    retiro = db.scalar(select(Retiro).where(Retiro.incidente_id == incidente.id))
    # `salida_id` no tiene FK declarada: la salida puede no estar.
    salida = db.get(Salida, incidente.salida_id) if incidente.salida_id else None
    lote = db.get(LoteProducto, incidente.lote_id) if incidente.lote_id else None
    relacionados, total = _relacionados(db, incidente, current_user)

    base = schemas.IncidenteResponse.model_validate(incidente)
    return schemas.IncidenteDetalleResponse(
        **base.model_dump(),
        equipo=_equipo(db, incidente.equipo),
        lote=_lote(lote),
        salida=salida_a_resumen(salida) if salida is not None else None,
        reclamo=reclamo_a_resumen(reclamo) if reclamo is not None else None,
        retiro=retiro_a_resumen(retiro) if retiro is not None else None,
        reposiciones=_reposiciones(db, incidente, retiro),
        relacionados=relacionados,
        relacionados_total=total,
    )


def _equipo(db: Session, equipo: Optional[Equipo]) -> Optional[schemas.IncidenteEquipo]:
    if equipo is None:
        return None
    planes = db.scalars(
        select(PlanCalibracionMantenimiento)
        .where(
            PlanCalibracionMantenimiento.equipo_id == equipo.id,
            PlanCalibracionMantenimiento.activo.is_(True),
        )
        .order_by(PlanCalibracionMantenimiento.tipo)
    ).all()
    return schemas.IncidenteEquipo(
        id=equipo.id,
        nombre=equipo.nombre,
        tipo=equipo.tipo,
        sector_nombre=equipo.sector.nombre if equipo.sector else None,
        activo=equipo.activo,
        planes=[
            schemas.IncidentePlanEquipo(
                tipo=plan.tipo,
                fecha_ultima_intervencion=plan.fecha_ultima_intervencion,
                proximo_vencimiento=plan.proxima_fecha_vencimiento,
                dias_restantes=plan.dias_restantes,
            )
            for plan in planes
        ],
    )


def _lote(lote: Optional[LoteProducto]) -> Optional[schemas.IncidenteLote]:
    if lote is None:
        return None
    return schemas.IncidenteLote(
        id=lote.id,
        numero_lote=lote.numero_lote,
        producto_nombre=lote.producto.nombre,
        unidad=lote.producto.unidad_medida.simbolo,
        estado=lote.estado,
        estado_lote=lote.estado_lote,
        retirado=lote.retirado,
        cantidad_producida=lote.cantidad_producida,
        saldo=lote.saldo,
        fecha_inicio=lote.fecha_inicio,
        fecha_vencimiento=lote.fecha_vencimiento,
    )


def _reposiciones(
    db: Session, incidente: Incidente, retiro: Optional[Retiro]
) -> List[schemas.IncidenteReposicion]:
    """Reposiciones que generó el incidente o el circuito que lo abrió."""
    origenes = [Reposicion.incidente_origen_id == incidente.id]
    # Las del rechazo y las del retiro se registran contra la salida o el
    # retiro. La salida solo vale para el rechazo: un reclamo comparte la
    # salida con otros reclamos y mostraría reposiciones ajenas.
    if incidente.tipo == TipoIncidente.ENTREGA_RECHAZADA.value and incidente.salida_id:
        origenes.append(Reposicion.salida_origen_id == incidente.salida_id)
    if retiro is not None:
        origenes.append(Reposicion.retiro_origen_id == retiro.id)

    filas = db.scalars(
        select(Reposicion).where(or_(*origenes)).order_by(Reposicion.id)
    ).all()
    return [
        schemas.IncidenteReposicion(
            id=fila.id,
            cliente_nombre=fila.cliente.nombre,
            producto_nombre=fila.producto.nombre,
            unidad=fila.producto.unidad_medida.simbolo,
            cantidad_original=fila.cantidad_original,
            cantidad_pendiente=fila.cantidad_pendiente,
            estado=fila.estado,
            prioridad=fila.prioridad,
            fecha_registro=fila.fecha_registro,
        )
        for fila in filas
    ]


def _relacionados(
    db: Session, incidente: Incidente, current_user: Personal
) -> tuple[List[schemas.IncidenteRelacionado], int]:
    """Otros incidentes del mismo equipo o lote, del más reciente al más viejo."""
    vinculos = []
    if incidente.equipo_id is not None:
        vinculos.append(Incidente.equipo_id == incidente.equipo_id)
    if incidente.lote_id is not None:
        vinculos.append(Incidente.lote_id == incidente.lote_id)
    if not vinculos:
        return [], 0

    condiciones = [Incidente.id != incidente.id, or_(*vinculos)]
    # Mismo criterio que la ficha: un operador solo ve los que reportó.
    if not (current_user.puede_administrar or current_user.es_super_admin):
        condiciones.append(Incidente.usuario_id == current_user.id)

    total = db.scalar(select(func.count(Incidente.id)).where(*condiciones)) or 0
    filas = db.scalars(
        select(Incidente)
        .where(*condiciones)
        .order_by(Incidente.fecha_reporte.desc(), Incidente.id.desc())
        .limit(MAXIMO_RELACIONADOS)
    ).all()
    return [schemas.IncidenteRelacionado.model_validate(f) for f in filas], total
