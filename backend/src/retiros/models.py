"""Modelos del dominio de retiros de lote (Historia 21).

- `Retiro`: retiro de un lote del mercado. Irreversible: no existe endpoint
  para revertirlo.
- `RetiroAfectado`: salida afectada por un retiro de lote. Una fila por cada
  salida `DESPACHADO` o `ENTREGADO` del lote al iniciar el retiro.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.models import ModeloBase
from src.personal.models import Personal

if TYPE_CHECKING:  # pragma: no cover - solo para tipado
    from src.lotes.models import LoteProducto
    from src.salidas.models import Salida


class Retiro(ModeloBase):
    """Retiro de un lote del mercado. Irreversible."""

    __tablename__ = "retiros"
    __table_args__ = (
        # Un solo retiro por lote: restricción de unicidad a nivel de BD.
        UniqueConstraint("lote_id", name="uq_retiros_lote_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        unique=True,
    )
    motivo: Mapped[str] = mapped_column(String(100), nullable=False)
    detalle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fecha_retiro: Mapped[date] = mapped_column(Date, nullable=False)
    iniciado_por_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=False
    )
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime, default=ahora, nullable=False
    )
    estado: Mapped[str] = mapped_column(
        String(20),
        default="EN_CURSO",
        server_default="EN_CURSO",
        nullable=False,
    )
    origen: Mapped[str] = mapped_column(String(20), nullable=False)
    # Sin FK declarada a propósito: igual criterio que reclamos e incidentes
    # para evitar ciclos de FK cruzadas.
    reclamo_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )
    incidente_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, index=True
    )
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cerrado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )
    accion_correctiva: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    iniciado_por: Mapped[Personal] = relationship(foreign_keys=[iniciado_por_id])
    cerrado_por: Mapped[Optional[Personal]] = relationship(
        foreign_keys=[cerrado_por_id]
    )
    afectados: Mapped[list["RetiroAfectado"]] = relationship(
        back_populates="retiro", cascade="all, delete-orphan"
    )


class RetiroAfectado(ModeloBase):
    """Salida afectada por un retiro de lote. Una fila por salida."""

    __tablename__ = "retiros_afectados"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    retiro_id: Mapped[int] = mapped_column(
        ForeignKey("retiros.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    salida_id: Mapped[int] = mapped_column(
        ForeignKey("salidas.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    estado_notificacion: Mapped[str] = mapped_column(
        String(20),
        default="PENDIENTE",
        server_default="PENDIENTE",
        nullable=False,
    )
    fecha_notificacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    medio_contacto: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    observacion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notificado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )

    retiro: Mapped["Retiro"] = relationship(back_populates="afectados")
    salida: Mapped["Salida"] = relationship()
    notificado_por: Mapped[Optional[Personal]] = relationship(
        foreign_keys=[notificado_por_id]
    )
