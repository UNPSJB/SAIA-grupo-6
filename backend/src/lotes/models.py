from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Index,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    event,
    select,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from src.common.fechas import ahora
from src.lotes.constants import (
    ESTADO_CANCELADO,
    ESTADO_EN_PROCESO,
    ESTADO_TERMINADO,
    ESTADOS_LOTE_CERRADOS,
    TIPO_CONSUMO_REAL,
)
from src.lotes.exceptions import LoteCerradoError
from sqlalchemy import inspect as sa_inspect
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento


class LoteProducto(DatosDeEstablecimiento, ModeloBase):
    """Lote producido. Apunta a la VERSIÓN de receta usada, no a la receta.

    `version_receta_id` es NULL solo en lotes históricos migrados del esquema
    anterior, que no tenían receta.
    """

    __tablename__ = "lotes_producto"
    __table_args__ = (
        CheckConstraint(
            "cantidad_objetivo > 0", name="ck_lotes_producto_objetivo_positivo"
        ),
        CheckConstraint(
            "cantidad_producida IS NULL OR cantidad_producida >= 0",
            name="ck_lotes_producto_producida_no_negativa",
        ),
        CheckConstraint(
            "estado IN ('en_proceso', 'terminado', 'cancelado')",
            name="ck_lotes_producto_estado_valido",
        ),
    )

    # Sin `index=True` en el id: el índice se llamaría `ix_lotes_producto_id`,
    # igual al de `lotes.producto_id` de la tabla vieja, que sigue en las bases migradas.
    id: Mapped[int] = mapped_column(primary_key=True)
    numero_lote: Mapped[str] = mapped_column(String(50), index=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), index=True
    )
    version_receta_id: Mapped[int | None] = mapped_column(
        ForeignKey("versiones_receta.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), default=ESTADO_EN_PROCESO, server_default=ESTADO_EN_PROCESO, index=True
    )
    cantidad_objetivo: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    factor_escala: Mapped[Decimal | None] = mapped_column(Numeric(14, 6), nullable=True)
    cantidad_producida: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    motivo_cancelacion: Mapped[str | None] = mapped_column(String(300), nullable=True)
    creado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, default=ahora, index=True)
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fecha_vencimiento: Mapped[date | None] = mapped_column(Date, nullable=True)

    producto: Mapped["Producto"] = relationship()
    version_receta: Mapped["VersionReceta | None"] = relationship()
    creado_por: Mapped["Personal | None"] = relationship()
    checklist: Mapped[list["ChecklistProduccion"]] = relationship(
        back_populates="lote", order_by="ChecklistProduccion.id"
    )
    # Salidas de producto (reservas, despachos, entregas) de este lote.
    salidas: Mapped[list["Salida"]] = relationship(
        back_populates="lote", cascade="all, delete-orphan"
    )

    # Campo de retiro del mercado (baja lógica del lote como fuente de venta).
    # Sin motivo ni fecha: eso corresponde a una historia posterior.
    retirado: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("0"), nullable=False
    )

    # -----------------------------------------------------------------------
    # Propiedades calculadas a partir de las salidas (NO se persisten).
    # Se calculan en memoria tras cargar las salidas con selectinload.
    # -----------------------------------------------------------------------

    @property
    def reservado(self) -> Decimal:
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["reservado"]

    @property
    def despachado(self) -> Decimal:
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["despachado"]

    @property
    def entregado(self) -> Decimal:
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["entregado"]

    @property
    def en_revision(self) -> Decimal:
        """Mercadería rechazada por el cliente que aún no tiene disposición."""
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["en_revision"]

    @property
    def desechado(self) -> Decimal:
        """Mercadería rechazada que se decidió desechar (dada de baja)."""
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["desechado"]

    @property
    def saldo(self) -> Decimal:
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["saldo"]

    @property
    def estado_lote(self) -> str:
        from src.salidas.models import calcular_cantidades

        salidas = list(self.salidas) if self.salidas is not None else []
        return calcular_cantidades(
            self.cantidad_producida, salidas, self.retirado
        )["estado_lote"]


class ChecklistProduccion(DatosDeEstablecimiento, ModeloBase):
    """Una fila por cada tarea de la versión de receta del lote."""

    __tablename__ = "checklist_produccion"
    __table_args__ = (
        UniqueConstraint(
            "lote_producto_id", "tarea_receta_id", name="uq_checklist_produccion_lote_tarea"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_producto_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"), index=True
    )
    tarea_receta_id: Mapped[int] = mapped_column(
        ForeignKey("tareas_receta.id", ondelete="RESTRICT"), index=True
    )
    completado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    completado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Quién tiene que hacer la tarea (como en el checklist de limpieza). Sin
    # asignar, la puede hacer cualquiera que opere.
    asignado_a_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True, index=True
    )

    lote: Mapped["LoteProducto"] = relationship(back_populates="checklist")
    tarea: Mapped["TareaReceta"] = relationship()
    completado_por: Mapped["Personal | None"] = relationship(foreign_keys=[completado_por_id])
    asignado_a: Mapped["Personal | None"] = relationship(foreign_keys=[asignado_a_id])
    consumos: Mapped[list["ConsumoInsumo"]] = relationship(
        back_populates="checklist", order_by="ConsumoInsumo.id"
    )


class ConsumoInsumo(DatosDeEstablecimiento, ModeloBase):
    """Consumo real o desperdicio accidental de un lote de insumo en una tarea.

    El lote de producto se obtiene por `checklist_produccion`; no se duplica
    la referencia acá para que no pueda quedar inconsistente con el checklist.
    """

    __tablename__ = "consumo_insumo"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_consumo_insumo_cantidad_positiva"),
        CheckConstraint(
            "tipo IN ('real', 'desperdicio')", name="ck_consumo_insumo_tipo_valido"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    checklist_produccion_id: Mapped[int] = mapped_column(
        ForeignKey("checklist_produccion.id", ondelete="RESTRICT"), index=True
    )
    lote_insumo_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_insumo.id", ondelete="RESTRICT"), index=True
    )
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    tipo: Mapped[str] = mapped_column(
        String(20), default=TIPO_CONSUMO_REAL, server_default=TIPO_CONSUMO_REAL, index=True
    )
    motivo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    registrado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    registrado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    checklist: Mapped["ChecklistProduccion"] = relationship(back_populates="consumos")
    lote_insumo: Mapped["LoteInsumo"] = relationship()
    registrado_por: Mapped["Personal | None"] = relationship()


def _estado_en_base(connection, lote_id: int) -> str | None:
    return connection.execute(
        select(LoteProducto.estado).where(LoteProducto.id == lote_id)
    ).scalar_one_or_none()


def _estado_por_checklist(connection, checklist_id: int) -> str | None:
    return connection.execute(
        select(LoteProducto.estado)
        .join(ChecklistProduccion, ChecklistProduccion.lote_producto_id == LoteProducto.id)
        .where(ChecklistProduccion.id == checklist_id)
    ).scalar_one_or_none()


@event.listens_for(LoteProducto, "before_update")
def impedir_editar_lote_cerrado(mapper, connection, target):
    """Respaldo del service: el estado se lee de la base, no de la memoria."""
    if not object_session(target).is_modified(target, include_collections=False):
        return
    estado_base = _estado_en_base(connection, target.id)
    if estado_base == ESTADO_CANCELADO:
        raise LoteCerradoError()
    if estado_base == ESTADO_TERMINADO:
        # En lotes TERMINADOS solo está permitido modificar el campo 'retirado';
        # cualquier otro campo modificado dispara LoteCerradoError.
        mapper_insp = sa_inspect(target)
        for attr in mapper_insp.attrs:
            hist = getattr(attr, "history", None)
            if hist is not None and hist.has_changes() and attr.key != "retirado":
                raise LoteCerradoError()


@event.listens_for(ChecklistProduccion, "before_insert")
@event.listens_for(ChecklistProduccion, "before_update")
@event.listens_for(ChecklistProduccion, "before_delete")
def impedir_editar_checklist_de_lote_cerrado(mapper, connection, target):
    if _estado_en_base(connection, target.lote_producto_id) in ESTADOS_LOTE_CERRADOS:
        raise LoteCerradoError()


@event.listens_for(ConsumoInsumo, "before_insert")
@event.listens_for(ConsumoInsumo, "before_update")
@event.listens_for(ConsumoInsumo, "before_delete")
def impedir_editar_consumo_de_lote_cerrado(mapper, connection, target):
    if _estado_por_checklist(connection, target.checklist_produccion_id) in ESTADOS_LOTE_CERRADOS:
        raise LoteCerradoError()


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_lotes_producto_establecimiento_numero_lote", LoteProducto.establecimiento_id, LoteProducto.numero_lote, unique=True)
