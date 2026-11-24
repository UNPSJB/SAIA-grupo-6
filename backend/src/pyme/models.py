from typing import Optional

from sqlalchemy import CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class ConfiguracionPyme(ModeloBase):
    """Datos de identidad de la Pyme, únicos para toda la instalación.

    Es una configuración de sistema (una sola fila, como la vista pública):
    se carga una vez y alimenta la cabecera de todos los documentos.
    """

    __tablename__ = "configuracion_pyme"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_configuracion_pyme_unica"),
    )

    # La PK fija más el CHECK impiden representar más de una Pyme.
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    razon_social: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    domicilio: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    web: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Opcional: no todas las Pymes tienen registro ante el organismo.
    rnpa_rppa: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Ruta relativa dentro de uploads/ (por ejemplo `uploads/pyme/logo_x.png`).
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
