from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from src.models import AUDITORIA_REDACTAR, ModeloBase


class ConfiguracionVistaPublica(ModeloBase):
    """Estado único de publicación para la instalación completa de SAIA."""

    __tablename__ = "configuracion_vista_publica"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_configuracion_vista_publica_unica"),
    )

    # La PK fija más el CHECK impiden representar más de una instalación.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    habilitada: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
    # Es un identificador opaco de acceso. La bitácora registra el cambio, no
    # el valor que permitiría reconstruir enlaces ya invalidados.
    codigo_publico: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        unique=True,
        info=AUDITORIA_REDACTAR,
    )


class IndicadorVistaPublica(ModeloBase):
    """Preferencia de publicación de un indicador agregado.

    La fila ausente se interpreta con el default del catálogo
    (`constants.CATALOGO`). Así una instalación nueva no necesita seed y la
    configuración sobrevive a desactivar/reactivar la vista pública.
    """

    __tablename__ = "indicadores_vista_publica"

    clave: Mapped[str] = mapped_column(String(60), primary_key=True)
    habilitado: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("0")
    )
