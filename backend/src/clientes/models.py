from sqlalchemy import Index, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento


class Cliente(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), index=True)
    documento: Mapped[str] = mapped_column(String(20), index=True)
    telefono: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    domicilio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[DateTime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_actualizacion: Mapped[DateTime | None] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=True
    )


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_clientes_establecimiento_documento", Cliente.establecimiento_id, Cliente.documento, unique=True)
