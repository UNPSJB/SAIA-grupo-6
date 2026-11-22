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
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora, hoy
from src.models import ModeloBase


class LoteInsumo(ModeloBase):
    
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
    # La marca que se recibió.
    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # El ingrediente de ese insumo, copiado al recibir el lote. Es lo que usan
    # el stock por ingrediente, los paneles y el consumo en producción (la
    # receta pide ingredientes, no marcas). El servicio garantiza que coincide
    # con `insumo.ingrediente_id`.
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"), nullable=False, index=True
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
    dado_de_baja_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    certificacion_id: Mapped[int | None] = mapped_column(
        ForeignKey("certificaciones_proveedor.id", ondelete="RESTRICT"), nullable=True
    )
    creado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    insumo: Mapped["Insumo"] = relationship()
    ingrediente: Mapped["Ingrediente"] = relationship()
    proveedor: Mapped["Proveedor"] = relationship()
    certificacion: Mapped["CertificacionProveedor | None"] = relationship()
    dado_de_baja_por: Mapped["Personal | None"] = relationship(
        foreign_keys=[dado_de_baja_por_id]
    )
    bajas: Mapped[list["BajaLoteInsumo"]] = relationship(
        back_populates="lote_insumo", cascade="all, delete-orphan"
    )


class BajaLoteInsumo(ModeloBase):
    """Registro auditado de baja parcial o total de un lote de insumo."""

    __tablename__ = "bajas_lote_insumo"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_bajas_lote_insumo_cantidad_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_insumo_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_insumo.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    motivo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    observaciones: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    foto_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=False
    )
    registrado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora, index=True)

    lote_insumo: Mapped["LoteInsumo"] = relationship(back_populates="bajas")
    registrado_por: Mapped["Personal"] = relationship()