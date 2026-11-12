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
    # Categoría usada por el motor de rotulado frontal. La lista de claves
    # válidas vive en la versión de la regla, no en este modelo.
    categoria_rotulado: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )
    # Compatibilidad con la primera versión: se mantiene sincronizado cuando
    # se elige una categoría en la pantalla de rotulado.
    categoria_exceptuada_por_ley: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0"
    )

    unidad_medida: Mapped["UnidadMedida"] = relationship()
