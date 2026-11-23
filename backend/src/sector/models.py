from typing import Optional
from sqlalchemy import Index, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento


class Sector(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "sectores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(60), index=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_sectores_establecimiento_nombre", Sector.establecimiento_id, Sector.nombre, unique=True)
