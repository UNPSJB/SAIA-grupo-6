from datetime import date
from typing import Optional
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Index, String, Boolean, Date, Integer

class ElementoLimpieza(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "elementos_limpieza"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(40), index=True)

    frecuencia_recambio_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    fecha_ultimo_recambio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=True)


# Único por establecimiento: dos sedes pueden tener un elemento con el mismo
# nombre (ver src/establecimientos).
Index(
    "uq_elementos_limpieza_establecimiento_nombre",
    ElementoLimpieza.establecimiento_id,
    ElementoLimpieza.nombre,
    unique=True,
)
