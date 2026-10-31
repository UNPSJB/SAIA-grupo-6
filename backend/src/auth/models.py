"""Modelo de datos de los tokens revocados (logout).

Guardamos el `jti` (identificador único) de cada tokeninvalidado para que
un access token deja de funcionar de inmediato al cerrar sesión, en lugar de
esperar a que expire.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Integer, Boolean, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class TokenRevocado(ModeloBase):
    # La bitácora no registra la revocación: es limpieza interna de sesión,
    # no una operación de negocio sobre una entidad del dominio.
    __audit__ = False

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


class RefreshToken(ModeloBase):
    """Refresh token rotado: uno por jti, con familia para detectar reuso.

    La rotación atómica se hace con `UPDATE ... SET usado = 1
    WHERE jti = :jti AND usado = 0` y verificando `rowcount == 1`. Si un
    token se reutiliza (rowcount == 0), se rechaza con 401 e invalidan todos
    los refresh tokens de su familia.
    """

    __audit__ = False
    __tablename__ = "refresh_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id", ondelete="CASCADE"), nullable=False
    )
    familia: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    usado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expira: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )


class IntentoLogin(ModeloBase):
    """Contador de intentos fallidos de login por IP + DNI.

    Se guarda en la base (compartido entre workers/replicas) en vez de en
    memoria, con bloqueo temporal y backoff.
    """

    __audit__ = False
    __tablename__ = "intentos_login"

    __table_args__ = (PrimaryKeyConstraint("ip", "dni"),)

    ip: Mapped[str] = mapped_column(String(45), nullable=False, primary_key=True)
    dni: Mapped[str] = mapped_column(String(8), nullable=False, primary_key=True)
    ultimo_intento: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    contador: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bloqueado_hasta: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )