from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase


class ConfiguracionAlerta(ModeloBase):
    """Ajustes de las alertas que el usuario puede cambiar desde la app."""

    __tablename__ = "configuracion_alertas"

    clave: Mapped[str] = mapped_column(String(60), primary_key=True)
    valor: Mapped[int] = mapped_column(Integer)