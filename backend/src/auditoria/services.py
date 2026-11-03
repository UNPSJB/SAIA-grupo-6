"""Consulta de la bitácora de auditoría.

La escritura vive en los listeners del ORM (`src.auditoria.listeners`);
este módulo es solo la lectura que expone el endpoint `GET /auditoria`.
"""

import logging
from datetime import date, datetime, time, timezone, tzinfo
from typing import Any, Iterator, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from src.auditoria.enriquecer import enriquecer_lote_auditoria
from src.auditoria.models import AuditLog
from src.auditoria.schemas import AuditLogItem, CambioCampoEnriquecido, RegistroAuditado
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
    consulta = _consulta_filtrada(
        entidad=entidad,
        entidad_id=entidad_id,
        usuario_id=usuario_id,
        accion=accion,
        desde=desde,
        hasta=hasta,
    )
    items, total = paginar(db, consulta, page, page_size)
    return _armar_items(db, items), total


def _consulta_filtrada(
    *,
    entidad: Optional[str],
    entidad_id: Optional[str],
    usuario_id: Optional[int],
    accion: Optional[str],
    desde: Optional[date],
    hasta: Optional[date],
):
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
    return consulta.order_by(AuditLog.fecha.desc(), AuditLog.id.desc())


def _armar_items(db: Session, items: list[AuditLog]) -> list[AuditLogItem]:
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

    # Enriquecer toda la página de una vez (una consulta IN por tabla, sin N+1):
    # nombres de las FKs de los cambios y el registro afectado de cada evento.
    enriquecidos: dict[int, dict[str, Any]] = (
        enriquecer_lote_auditoria(db, items) if items else {}
    )

    # Se arman los schemas en vez de pegarle atributos sueltos a las
    # instancias ORM de la sesión.
    resultado = []
    for fila in items:
        item = AuditLogItem.model_validate(fila)
        item.usuario_nombre = nombres.get(fila.usuario_id)

        extra = enriquecidos.get(fila.id) or {}
        detalle = extra.get("cambios_detalle")
        if detalle is not None:
            item.cambios_detalle = {
                campo: CambioCampoEnriquecido.model_validate(valor)
                for campo, valor in detalle.items()
            }
        if extra.get("registro") is not None:
            item.registro = RegistroAuditado.model_validate(extra["registro"])

        resultado.append(item)

    return resultado


LOTE_EXPORTACION = 500


def iterar_auditoria(
    db: Session,
    *,
    entidad: Optional[str] = None,
    entidad_id: Optional[str] = None,
    usuario_id: Optional[int] = None,
    accion: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
) -> Iterator[AuditLogItem]:
    """Todos los eventos que cumplen los filtros (sin paginar), en lotes."""
    consulta = _consulta_filtrada(
        entidad=entidad,
        entidad_id=entidad_id,
        usuario_id=usuario_id,
        accion=accion,
        desde=desde,
        hasta=hasta,
    )
    pagina = 1
    while True:
        filas, _ = paginar(db, consulta, pagina, LOTE_EXPORTACION)
        if not filas:
            return
        yield from _armar_items(db, filas)
        if len(filas) < LOTE_EXPORTACION:
            return
        pagina += 1


def listar_entidades(db: Session) -> list[str]:
    """Devuelve las entidades distintas presentes en la bitácora."""
    consulta = select(distinct(AuditLog.entidad)).order_by(AuditLog.entidad)
    return [r[0] for r in db.execute(consulta).all()]


def obtener_auditoria_por_id(db: Session, audit_id: int) -> AuditLog | None:
    """Devuelve un evento de auditoría por su ID, o None si no existe."""
    return db.get(AuditLog, audit_id)