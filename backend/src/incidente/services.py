import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from src.common.persistence import guardar
from src.incidente import models, schemas, exceptions
from src.incidente.constants import EstadoIncidente
from src.Equipo.models import Equipo
from src.personal.models import Personal

logger = logging.getLogger(__name__)


# Relaciones que se cargan siempre para poder devolver los nombres en la respuesta.
_RELACIONES = (
    selectinload(models.Incidente.equipo),
    selectinload(models.Incidente.usuario),
    selectinload(models.Incidente.responsable_cierre),
)


def _nombre_completo(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _completar_nombres(incidentes: List[models.Incidente]) -> List[models.Incidente]:
    """Las relaciones se cargan a mano para evitar consultas perezosas."""
    for inc in incidentes:
        if inc.equipo:
            inc.equipo_nombre = inc.equipo.nombre
        inc.usuario_nombre = _nombre_completo(inc.usuario)
        inc.responsable_cierre_nombre = _nombre_completo(inc.responsable_cierre)
    return incidentes


def _verificar_equipo(db: Session, equipo_id: Optional[int]) -> None:
    """Verifica que el equipo exista y esté activo (si se especifica)."""
    if equipo_id is None:
        return
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if equipo is None:
        raise exceptions.EquipoNoEncontrado()
    if not equipo.activo:
        raise exceptions.EquipoInactivo()


def _verificar_usuario(db: Session, usuario_id: int) -> None:
    """Verifica que el usuario exista y esté activo."""
    usuario = db.scalar(select(Personal).where(Personal.id == usuario_id))
    if usuario is None:
        raise exceptions.UsuarioNoEncontrado()
    if not usuario.activo:
        raise exceptions.UsuarioInactivo()


def crear_incidente(db: Session, datos: schemas.IncidenteCreate, usuario_id: int) -> models.Incidente:
    _verificar_equipo(db, datos.equipo_id)
    _verificar_usuario(db, usuario_id)

    incidente = models.Incidente(
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        equipo_id=datos.equipo_id,
        foto_url=datos.foto_url,
        usuario_id=usuario_id,
        fecha_reporte=datetime.now(),
        estado=EstadoIncidente.ABIERTO.value,
    )
    db.add(incidente)
    return guardar(db, incidente)


def listar_incidentes(
    db: Session,
    estado: Optional[EstadoIncidente] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
) -> List[models.Incidente]:
    """Lista los incidentes del más reciente al más viejo.

    Sin `estado` devuelve todos (abiertos y cerrados); con `estado` filtra.
    """
    consulta = (
        select(models.Incidente)
        .options(*_RELACIONES)
        .order_by(models.Incidente.fecha_reporte.desc())
    )
    if estado:
        consulta = consulta.where(models.Incidente.estado == estado.value)
    if tipo:
        consulta = consulta.where(models.Incidente.tipo == tipo)
    if equipo_id:
        consulta = consulta.where(models.Incidente.equipo_id == equipo_id)

    return _completar_nombres(list(db.scalars(consulta).all()))


def obtener_incidente(db: Session, incidente_id: int, current_user: Personal) -> models.Incidente:
    incidente = db.scalar(
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()

    # Operador solo ve sus propios incidentes
    if not (current_user.puede_administrar or current_user.es_super_admin):
        if incidente.usuario_id != current_user.id:
            raise exceptions.PermisoDenegado()

    _completar_nombres([incidente])
    return incidente


def listar_mis_incidentes(db: Session, usuario_id: int) -> List[models.Incidente]:
    """Lista los incidentes reportados por un usuario específico (para operadores)."""
    consulta = (
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.usuario_id == usuario_id)
        .order_by(models.Incidente.fecha_reporte.desc())
    )
    return _completar_nombres(list(db.scalars(consulta).all()))


def cambiar_estado_incidente(
    db: Session,
    incidente_id: int,
    estado: EstadoIncidente,
    current_user: Personal,
    observacion_cierre: Optional[str] = None,
) -> models.Incidente:
    """Cierra o reabre un incidente.

    Al cerrar se asienta la acción correctiva, cuándo se cerró y quién lo
    resolvió. Al reabrir se limpia esa información para que no quede
    desactualizada.
    """
    incidente = db.scalar(
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()

    if incidente.estado == estado.value:
        # Ya está en ese estado: no se pisa la fecha de cierre original.
        # Aun así hay que completar los nombres: sin esto, este camino
        # devolvía los tres campos de nombre en null (son Optional, así que
        # la inconsistencia con el GET pasaba inadvertida).
        return _completar_nombres([incidente])[0]

    if estado == EstadoIncidente.CERRADO:
        _verificar_usuario(db, current_user.id)
        incidente.estado = EstadoIncidente.CERRADO.value
        incidente.fecha_cierre = datetime.now()
        incidente.responsable_cierre_id = current_user.id
        incidente.observacion_cierre = observacion_cierre
        logger.info(
            "Incidente %s cerrado por %s", incidente.id, current_user.id
        )
    else:
        incidente.estado = EstadoIncidente.ABIERTO.value
        incidente.fecha_cierre = None
        incidente.responsable_cierre_id = None
        incidente.observacion_cierre = None
        logger.info("Incidente %s reabierto por %s", incidente.id, current_user.id)

    guardar(db, incidente)

    # refresh deja las relaciones sin cargar: hay que volver a consultarlas.
    return obtener_incidente(db, incidente_id, current_user)