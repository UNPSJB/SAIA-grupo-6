from typing import Optional
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase


class Aptitud(ModeloBase):
    __tablename__ = "aptitudes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)