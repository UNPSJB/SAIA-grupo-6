"""Modelo de la bitácora de auditoría.

Una única tabla `audit_log` concentra el rastro de TODAS las entidades del
dominio. Las filas no las escriben los services: las escriben los listeners
del ORM (ver `src.auditoria.listeners`) dentro del mismo flush del cambio
auditado, así el registro comparte la transacción y no hay huérfanos si el
commit falla.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class AuditLog(ModeloBase):
    """Un evento de escritura: quién cambió qué entidad, cuándo y cómo."""

    # La bitácora no se audita a sí misma: el listener de after_insert
    # dispararía un INSERT sobre esta misma tabla en cada registro.
    __audit__ = False

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # UTC naive (mismo criterio que `tokens_revocados.revocado_en`).
    fecha: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        index=True,
    )

    # Quién hizo el cambio. NULL = sistema/script: nadie inició sesión.
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # `__tablename__` del objeto auditado ("equipos", "personal", ...).
    entidad: Mapped[str] = mapped_column(String(60))

    # PK del objeto auditado; si es compuesta, unida con "-".
    entidad_id: Mapped[str] = mapped_column(String(40))

    # CREAR | MODIFICAR | BAJA | REACTIVAR | ELIMINAR.
    accion: Mapped[str] = mapped_column(String(15))

    # El diff del evento, siempre como {"campo": [antes, despues]}.
    # En un CREAR `antes` es null; en un ELIMINAR lo es `despues`.
    cambios: Mapped[dict[str, Any]] = mapped_column(JSON)

    __table_args__ = (
        # El historial de una fila se consulta por su par entidad + id.
        Index("ix_audit_log_entidad_entidad_id", "entidad", "entidad_id"),
    )
