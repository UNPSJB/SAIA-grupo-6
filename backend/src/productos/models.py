from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase
from src.unidadMedida.models import UnidadMedida


class Producto(ModeloBase):
    """Producto elaborado. Tiene una receta (con versiones) y se produce en lotes."""

    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    descripcion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unidad_medida_id: Mapped[int] = mapped_column(
        ForeignKey("unidades_medida.id"), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    unidad_medida: Mapped["UnidadMedida"] = relationship()
