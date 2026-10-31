from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum as SQLEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase
from src.unidadMedida.models import UnidadMedida


class TipoQuimico(str, Enum):
    DETERGENTE = "detergente"
    DESINFECTANTE = "desinfectante"
    DESENGRASANTE = "desengrasante"
    SANITIZANTE = "sanitizante"


class TipoMovimientoStock(str, Enum):
    INGRESO = "ingreso"
    AJUSTE_POSITIVO = "ajuste_positivo"
    AJUSTE_NEGATIVO = "ajuste_negativo"
    CONSUMO_AUTOMATICO = "consumo_automatico"
    REVERSO_CONSUMO = "reverso_consumo"


class InsumoQuimico(ModeloBase):
    __tablename__ = "insumos_quimicos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    tipo: Mapped[TipoQuimico] = mapped_column()
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    unidad_medida: Mapped["UnidadMedida"] = relationship()


class StockInsumoQuimico(ModeloBase):
    """Saldo actual independiente del catálogo del producto."""

    __tablename__ = "stock_insumos_quimicos"
    __table_args__ = (
        CheckConstraint("cantidad_actual >= 0", name="ck_stock_cantidad_no_negativa"),
        CheckConstraint(
            "stock_minimo IS NULL OR stock_minimo >= 0",
            name="ck_stock_minimo_no_negativo",
        ),
    )

    insumo_quimico_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_quimicos.id"), primary_key=True
    )
    cantidad_actual: Mapped[Decimal] = mapped_column(
        Numeric(14, 3), nullable=False, default=Decimal("0")
    )
    stock_minimo: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=False
    )

    insumo_quimico: Mapped["InsumoQuimico"] = relationship()


class MovimientoStockInsumoQuimico(ModeloBase):
    """Libro mayor inmutable de variaciones de stock."""

    __tablename__ = "movimientos_stock_insumos_quimicos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insumo_quimico_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_quimicos.id"), nullable=False, index=True
    )
    cantidad_variacion: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    tipo: Mapped[TipoMovimientoStock] = mapped_column(SQLEnum(TipoMovimientoStock), nullable=False, index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False, index=True)
    motivo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    responsable_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"), nullable=True)
    responsable_nombre: Mapped[str | None] = mapped_column(String(160), nullable=True)

    # Estas referencias y sus snapshots permiten auditar el movimiento aunque
    # después cambie el catálogo o se elimine una tarea del plan.
    checklist_id: Mapped[int | None] = mapped_column(ForeignKey("checklists.id"), nullable=True, index=True)
    registro_tarea_id: Mapped[int | None] = mapped_column(
        ForeignKey("registro_tareas.id"), nullable=True, index=True
    )
    checklist_fecha: Mapped[date | None] = mapped_column(Date, nullable=True)
    tarea_nombre: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nombre_producto: Mapped[str] = mapped_column(String(100), nullable=False)
    unidad_simbolo: Mapped[str | None] = mapped_column(String(30), nullable=True)

    lote_ingreso: Mapped["LoteStock | None"] = relationship(back_populates="movimiento_ingreso")


class LoteStock(ModeloBase):
    """Registro inmutable de la recepción identificada por un lote."""

    __tablename__ = "lotes_stock"
    __table_args__ = (
        CheckConstraint("cantidad_producto > 0", name="ck_lote_stock_cantidad_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id"), nullable=False, index=True)
    insumo_quimico_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_quimicos.id"), nullable=False, index=True
    )
    numero_lote: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    cantidad_producto: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    fecha_ingreso: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False, index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    movimiento_ingreso_id: Mapped[int] = mapped_column(
        ForeignKey("movimientos_stock_insumos_quimicos.id"), nullable=False, unique=True, index=True
    )

    proveedor: Mapped["Proveedor"] = relationship()
    insumo_quimico: Mapped["InsumoQuimico"] = relationship()
    movimiento_ingreso: Mapped["MovimientoStockInsumoQuimico"] = relationship(
        back_populates="lote_ingreso"
    )
