from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.certificaciones_transportista.estado import estado_habilitacion
from src.models import ModeloBase


class Transportista(ModeloBase):
    __tablename__ = "transportistas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    razon_social: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    cuit: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    telefono: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    domicilio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[DateTime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_actualizacion: Mapped[DateTime | None] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=True
    )

    certificaciones = relationship(
        "CertificacionTransportista",
        back_populates="transportista",
        cascade="all, delete-orphan",
    )

    @property
    def estado_habilitacion(self) -> str:
        """Estado global calculado al serializar; nunca se persiste."""
        return estado_habilitacion(self.certificaciones)
