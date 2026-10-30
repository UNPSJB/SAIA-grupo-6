from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase


class Proveedor(ModeloBase):
    __tablename__ = "proveedores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), index=True)
    matricula: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
