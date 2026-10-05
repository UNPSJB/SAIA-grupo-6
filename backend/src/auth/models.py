"""Modelo de datos de los tokens revocados (logout).

Guardamos el `jti` (identificador único) de cada tokeninvalidado para que
un access token deja de funcionar de inmediato al cerrar sesión, en lugar de
esperar a que expire.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class TokenRevocado(ModeloBase):
    __tablename__ = "tokens_revocados"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="CASCADE"),
        nullable=True,
    )
    tipo: Mapped[str] = mapped_column(String(16))
    # Cuándo deja de ser necesario el registro (mismo vencimiento del token).
    expira: Mapped[datetime] = mapped_column(DateTime)
    revocado_en: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )