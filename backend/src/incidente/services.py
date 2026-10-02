import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from src.incidente import models, schemas, exceptions
from src.incidente.constants import TipoIncidente
from src.Equipo.models import Equipo
from src.personal.models import Personal

logger = logging.getLogger(__name__)


def _verificar_equipo(db: Session, equipo_id: Optional[int]) -> None:
    """Verifica que el equipo exista y esté activo (si se especifica)."""
    if equipo_id is None:
        return
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if equipo is None:
        raise exceptions.EquipoNoEncontrado()
    if not equipo.activo:
        raise exceptions.EquipoNoEncontrado()


def _verificar_usuario(db: Session, usuario_id: int) -> None:
    """Verifica que el usuario exista y esté activo."""
    usuario = db.scalar(select(Personal).where(Personal.id == usuario_id))
    if usuario is None:
        raise exceptions.UsuarioNoEncontrado()
    if not usuario.activo:
        raise exceptions.UsuarioInactivo()


def crear_incidente(db: Session, datos: schemas.IncidenteCreate) -> models.Incidente:
    _verificar_equipo(db, datos.equipo_id)
    _verificar_usuario(db, datos.usuario_id)

    incidente = models.Incidente(
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        equipo_id=datos.equipo_id,
        foto_url=datos.foto_url,
        usuario_id=datos.usuario_id,
        fecha_reporte=datetime.now(),
    )
    db.add(incidente)
    db.commit()
    db.refresh(incidente)
    return incidente


def listar_incidentes(
    db: Session,
    incluir_inactivos: bool = False,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
) -> List[models.Incidente]:
    consulta = (
        select(models.Incidente)
        .options(selectinload(models.Incidente.equipo), selectinload(models.Incidente.usuario))
        .order_by(models.Incidente.fecha_reporte.desc())
    )
    if not incluir_inactivos:
        consulta = consulta.where(models.Incidente.activo == True)
    if tipo:
        consulta = consulta.where(models.Incidente.tipo == tipo)
    if equipo_id:
        consulta = consulta.where(models.Incidente.equipo_id == equipo_id)
    
    incidentes = list(db.scalars(consulta).all())
    
    # Cargar nombres de equipo y usuario
    for inc in incidentes:
        if inc.equipo:
            inc.equipo_nombre = inc.equipo.nombre
        if inc.usuario:
            inc.usuario_nombre = f"{inc.usuario.nombre} {inc.usuario.apellido or ''}".strip()
    
    return incidentes


def obtener_incidente(db: Session, incidente_id: int) -> models.Incidente:
    incidente = db.scalar(
        select(models.Incidente)
        .options(selectinload(models.Incidente.equipo), selectinload(models.Incidente.usuario))
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()
    
    # Cargar nombres de equipo y usuario
    if incidente.equipo:
        incidente.equipo_nombre = incidente.equipo.nombre
    if incidente.usuario:
        incidente.usuario_nombre = f"{incidente.usuario.nombre} {incidente.usuario.apellido or ''}".strip()
    
    return incidente


def eliminar_incidente(db: Session, incidente_id: int) -> models.Incidente:
    incidente = obtener_incidente(db, incidente_id)
    incidente.activo = False
    db.commit()
    db.refresh(incidente)
    return incidente
