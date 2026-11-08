from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora, hoy
from src.models import ModeloBase


class LoteInsumo(ModeloBase):
    """Lote de un insumo recibido de un proveedor.

    No guarda stock: el saldo se calcula (recibido - consumos). Con consumos
    asociados no se borra; se da de baja (`activo=False`).
    """

    __tablename__ = "lotes_insumo"
    __table_args__ = (
        UniqueConstraint(
            "proveedor_id",
            "insumo_id",
            "numero_lote",
            name="uq_lotes_insumo_proveedor_insumo_numero",
        ),
        CheckConstraint(
            "cantidad_recibida > 0", name="ck_lotes_insumo_cantidad_positiva"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    proveedor_id: Mapped[int] = mapped_column(
        ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    numero_lote: Mapped[str] = mapped_column(String(100), index=True)
    cantidad_recibida: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    fecha_ingreso: Mapped[date] = mapped_column(Date, default=hoy, index=True)
    fecha_vencimiento: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    motivo_baja: Mapped[str | None] = mapped_column(String(300), nullable=True)
    fecha_baja: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    creado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    insumo: Mapped["Insumo"] = relationship()
    proveedor: Mapped["Proveedor"] = relationship()
