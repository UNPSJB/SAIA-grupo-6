from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class CertificacionTransportista(ModeloBase):
    __tablename__ = "certificaciones_transportista"

    # Una sola certificación activa por transportista y tipo normalizado.
    # El índice es parcial para que el historial (activa = 0) no bloquee.
    __table_args__ = (
        Index(
            "uq_certificaciones_transportista_tipo_activa",
            "transportista_id",
            "tipo_normalizado",
            unique=True,
            sqlite_where=text("activa = 1"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    transportista_id: Mapped[int] = mapped_column(
        ForeignKey("transportistas.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    # Calculado por el backend al guardar (trim, espacios colapsados,
    # minúsculas y sin tildes). El usuario nunca lo ve ni lo envía.
    tipo_normalizado: Mapped[str] = mapped_column(String(100), nullable=False)
    numero: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_emision: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    archivo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    anulada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    motivo_anulacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Id del usuario de Personal que anuló. Se guarda sin FK explícita para
    # que el esquema coincida con la migración (SQLite no permite agregar
    # una FK con ALTER TABLE).
    anulada_por: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fecha_anulacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    fecha_actualizacion: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=True
    )

    transportista = relationship("Transportista", back_populates="certificaciones")
