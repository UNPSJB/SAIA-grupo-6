from sqlalchemy import Index, Boolean, ForeignKey, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento
from src.unidadMedida.models import UnidadMedida


class Producto(DatosDeEstablecimiento, ModeloBase):
    """Producto elaborado. Tiene una receta (con versiones) y se produce en lotes."""

    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conservacion: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    nombre: Mapped[str] = mapped_column(String(120), index=True)
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


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_productos_establecimiento_nombre", Producto.establecimiento_id, Producto.nombre, unique=True)
