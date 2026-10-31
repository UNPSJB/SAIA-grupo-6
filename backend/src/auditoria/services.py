"""Consulta de la bitácora de auditoría.

La escritura vive en los listeners del ORM (`src.auditoria.listeners`);
este módulo es solo la lectura que expone el endpoint `GET /auditoria`.
"""

import logging
from datetime import date, datetime, time, timezone, tzinfo
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from src.auditoria.models import AuditLog
from src.auditoria.schemas import AuditLogItem
from src.common.paginacion import paginar
from src.config import settings
from src.personal.models import Personal

logger = logging.getLogger(__name__)


def _zona_local() -> tzinfo:
    """Zona horaria en la que la gente piensa los días (`ZONA_HORARIA`).

    `audit_log.fecha` se guarda en UTC, pero quien filtra "el 28" quiere el
    28 de su calendario, no el UTC. Si la zona no se puede resolver (por
    ejemplo, Windows sin el paquete `tzdata`) se avisa y se cae a UTC.
    """
    try:
        return ZoneInfo(settings.ZONA_HORARIA)
    except ZoneInfoNotFoundError:
        logger.warning(
            "Zona horaria %r no disponible (¿falta el paquete tzdata?): "
            "los filtros de fecha de la auditoría usan UTC.",
            settings.ZONA_HORARIA,
        )
        return timezone.utc


def _limite_utc(dia: date, hora: time) -> datetime:
    """Instante de `dia` + `hora` en la zona local, como UTC naive (como `fecha`)."""
    local = datetime.combine(dia, hora, tzinfo=_zona_local())
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def listar_auditoria(
    db: Session,
    *,
    entidad: Optional[str] = None,
    entidad_id: Optional[str] = None,
    usuario_id: Optional[int] = None,
    accion: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[AuditLogItem], int]:
    """Página de la bitácora con los filtros aplicados en la base.

    `desde` / `hasta` son días del calendario LOCAL (`ZONA_HORARIA`): la
    comparación cubre el día completo (00:00:00 a 23:59:59.999999 locales),
    convertido a UTC porque `fecha` se guarda en UTC.
    """
    consulta = select(AuditLog)

    if entidad is not None:
        consulta = consulta.where(AuditLog.entidad == entidad)
    if entidad_id is not None:
        consulta = consulta.where(AuditLog.entidad_id == entidad_id)
    if usuario_id is not None:
        consulta = consulta.where(AuditLog.usuario_id == usuario_id)
    if accion is not None:
        consulta = consulta.where(AuditLog.accion == accion)
    if desde is not None:
        consulta = consulta.where(AuditLog.fecha >= _limite_utc(desde, time.min))
    if hasta is not None:
        consulta = consulta.where(AuditLog.fecha <= _limite_utc(hasta, time.max))

    # Orden estable con desempate por id: dos eventos del mismo segundo no
    # pueden repetirse ni omitirse entre páginas.
    consulta = consulta.order_by(AuditLog.fecha.desc(), AuditLog.id.desc())

    items, total = paginar(db, consulta, page, page_size)

    # Enriquecer con el nombre del actor para la UI, en una sola consulta.
    ids = {fila.usuario_id for fila in items if fila.usuario_id}
    nombres: dict[int, str] = {}
    if ids:
        personas = db.execute(
            select(Personal.id, Personal.nombre, Personal.apellido).where(
                Personal.id.in_(ids)
            )
        ).all()
        nombres = {
            p.id: " ".join(parte for parte in (p.nombre, p.apellido) if parte)
            for p in personas
        }

    # Se arman los schemas en vez de pegarle atributos sueltos a las
    # instancias ORM de la sesión.
    resultado = []
    for fila in items:
        item = AuditLogItem.model_validate(fila)
        item.usuario_nombre = nombres.get(fila.usuario_id)
        resultado.append(item)

    return resultado, total


def listar_entidades(db: Session) -> list[str]:
    """Devuelve las entidades distintas presentes en la bitácora."""
    consulta = select(distinct(AuditLog.entidad)).order_by(AuditLog.entidad)
    return [r[0] for r in db.execute(consulta).all()]