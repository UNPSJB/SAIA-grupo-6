from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase

ESTADO_PENDIENTE = "Pendiente"
ESTADOS_LOTE = ("Pendiente", "En proceso", "Finalizado", "Cancelado")


class LoteProduccion(ModeloBase):
    __tablename__ = "lotes"
    __table_args__ = (
        CheckConstraint(
            "cantidad_planificada > 0",
            name="ck_lotes_cantidad_planificada_positiva",
        ),
        CheckConstraint(
            "cantidad_producida >= 0",
            name="ck_lotes_cantidad_producida_no_negativa",
        ),
        CheckConstraint(
            "estado IN ('Pendiente', 'En proceso', 'Finalizado', 'Cancelado')",
            name="ck_lotes_estado_valido",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    codigo_lote: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    producto_nombre: Mapped[str] = mapped_column(String(120), index=True)
    cantidad_planificada: Mapped[int] = mapped_column(Integer)
    cantidad_producida: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    estado: Mapped[str] = mapped_column(
        String(20), default=ESTADO_PENDIENTE, server_default=ESTADO_PENDIENTE
    )
    fecha_inicio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    insumos: Mapped[list["InsumoLote"]] = relationship(
        back_populates="lote", cascade="all, delete-orphan"
    )


class InsumoLote(ModeloBase):
    __tablename__ = "lotes_insumos"
    __table_args__ = (
        CheckConstraint(
            "cantidad > 0",
            name="ck_lotes_insumos_cantidad_positiva",
        ),
        UniqueConstraint(
            "lote_id",
            "insumo_id",
            name="uq_lotes_insumos_lote_insumo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_id: Mapped[int] = mapped_column(
        ForeignKey("lotes.id"), nullable=False, index=True
    )
    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id"), nullable=False, index=True
    )
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lote: Mapped["LoteProduccion"] = relationship(back_populates="insumos")
    insumo: Mapped["Insumo"] = relationship()
