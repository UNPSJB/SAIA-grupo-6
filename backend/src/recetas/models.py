from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship

from src.common.fechas import ahora
from src.models import ModeloBase
from src.recetas.constants import CLASIFICACIONES
from src.recetas.exceptions import VersionRecetaInmutableError


class Receta(ModeloBase):
    """Receta de un producto. El contenido vive en sus versiones."""

    __tablename__ = "recetas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), unique=True, index=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    producto: Mapped["Producto"] = relationship()
    versiones: Mapped[list["VersionReceta"]] = relationship(
        back_populates="receta", order_by="VersionReceta.numero"
    )


class VersionReceta(ModeloBase):
    """Foto inmutable de la receta. Modificar la receta crea una versión nueva."""

    __tablename__ = "versiones_receta"
    __table_args__ = (
        UniqueConstraint("receta_id", "numero", name="uq_versiones_receta_numero"),
        CheckConstraint("numero > 0", name="ck_versiones_receta_numero_positivo"),
        CheckConstraint("rendimiento > 0", name="ck_versiones_receta_rendimiento_positivo"),
        CheckConstraint(
            "porcion_cantidad IS NULL OR porcion_cantidad > 0",
            name="ck_versiones_receta_porcion_positiva",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    receta_id: Mapped[int] = mapped_column(
        ForeignKey("recetas.id", ondelete="RESTRICT"), index=True
    )
    numero: Mapped[int] = mapped_column(Integer)
    rendimiento: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"))
    # Porción o unidad de venta (E9): p. ej. "Frasco" de 450 g. Opcional.
    porcion_descripcion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    porcion_cantidad: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    porcion_unidad_medida_id: Mapped[int | None] = mapped_column(
        ForeignKey("unidades_medida.id"), nullable=True
    )
    creado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora)

    receta: Mapped["Receta"] = relationship(back_populates="versiones")
    unidad_medida: Mapped["UnidadMedida"] = relationship(foreign_keys=[unidad_medida_id])
    porcion_unidad_medida: Mapped["UnidadMedida | None"] = relationship(
        foreign_keys=[porcion_unidad_medida_id]
    )
    creado_por: Mapped["Personal | None"] = relationship()
    tareas: Mapped[list["TareaReceta"]] = relationship(
        back_populates="version", order_by="TareaReceta.orden"
    )
    insumos: Mapped[list["RecetaInsumo"]] = relationship(
        back_populates="version", order_by="RecetaInsumo.id"
    )


class TareaReceta(ModeloBase):
    """Etapa de elaboración. Pertenece a una versión, nunca a la receta en general."""

    __tablename__ = "tareas_receta"
    __table_args__ = (
        UniqueConstraint("version_receta_id", "orden", name="uq_tareas_receta_orden"),
        CheckConstraint("orden > 0", name="ck_tareas_receta_orden_positivo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_receta_id: Mapped[int] = mapped_column(
        ForeignKey("versiones_receta.id", ondelete="RESTRICT"), index=True
    )
    orden: Mapped[int] = mapped_column(Integer)
    descripcion: Mapped[str] = mapped_column(String(300))

    version: Mapped["VersionReceta"] = relationship(back_populates="tareas")
    insumos: Mapped[list["TareaRecetaInsumo"]] = relationship(
        back_populates="tarea", order_by="TareaRecetaInsumo.id"
    )


class RecetaInsumo(ModeloBase):
    """Insumo de una versión: cantidad total, unidad y clasificación."""

    __tablename__ = "receta_insumo"
    __table_args__ = (
        UniqueConstraint("version_receta_id", "insumo_id", name="uq_receta_insumo_version_insumo"),
        CheckConstraint("cantidad > 0", name="ck_receta_insumo_cantidad_positiva"),
        CheckConstraint(
            "clasificacion IN ('ingrediente', 'aditivo')",
            name="ck_receta_insumo_clasificacion_valida",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    version_receta_id: Mapped[int] = mapped_column(
        ForeignKey("versiones_receta.id", ondelete="RESTRICT"), index=True
    )
    insumo_id: Mapped[int] = mapped_column(ForeignKey("insumos.id"), index=True)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"))
    clasificacion: Mapped[str] = mapped_column(String(20))

    version: Mapped["VersionReceta"] = relationship(back_populates="insumos")
    insumo: Mapped["Insumo"] = relationship()
    unidad_medida: Mapped["UnidadMedida"] = relationship()


class TareaRecetaInsumo(ModeloBase):
    """Reparto explícito: cuánto de cada insumo se usa en cada tarea."""

    __tablename__ = "tarea_receta_insumo"
    __table_args__ = (
        UniqueConstraint("tarea_receta_id", "receta_insumo_id", name="uq_tarea_receta_insumo"),
        CheckConstraint("cantidad > 0", name="ck_tarea_receta_insumo_cantidad_positiva"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tarea_receta_id: Mapped[int] = mapped_column(
        ForeignKey("tareas_receta.id", ondelete="RESTRICT"), index=True
    )
    receta_insumo_id: Mapped[int] = mapped_column(
        ForeignKey("receta_insumo.id", ondelete="RESTRICT"), index=True
    )
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))

    tarea: Mapped["TareaReceta"] = relationship(back_populates="insumos")
    receta_insumo: Mapped["RecetaInsumo"] = relationship()


@event.listens_for(VersionReceta, "before_update")
@event.listens_for(TareaReceta, "before_update")
@event.listens_for(RecetaInsumo, "before_update")
@event.listens_for(TareaRecetaInsumo, "before_update")
def impedir_modificar_version(mapper, connection, target):
    """Una versión ya creada es de solo lectura: el historial no se reescribe."""
    if object_session(target).is_modified(target, include_collections=False):
        raise VersionRecetaInmutableError()


@event.listens_for(VersionReceta, "before_delete")
@event.listens_for(TareaReceta, "before_delete")
@event.listens_for(RecetaInsumo, "before_delete")
@event.listens_for(TareaRecetaInsumo, "before_delete")
def impedir_borrar_version(mapper, connection, target):
    raise VersionRecetaInmutableError()
