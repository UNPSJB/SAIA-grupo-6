"""Insumo: el producto concreto que se compra (una marca de un ingrediente).

El ingrediente es la especificación ("Pan lactal", "Bicarbonato de sodio"):
lo usa la receta y de él sale la tabla nutricional. El insumo es lo que
llega del proveedor ("Pan lactal Marca A"): se recibe en lotes y la
trazabilidad dice qué marca exacta entró en cada lote de producto.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Numeric, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase

# Qué proveedores venden cada insumo: una misma marca puede comprarse a más de
# un distribuidor, y un proveedor vende varias.
proveedores_insumos = Table(
    "proveedores_insumos",
    ModeloBase.metadata,
    Column("proveedor_id", ForeignKey("proveedores.id", ondelete="CASCADE"), primary_key=True),
    Column("insumo_id", ForeignKey("insumos.id", ondelete="CASCADE"), primary_key=True),
)


# Estados de la homologación de un insumo contra su ingrediente.
ESTADO_PENDIENTE = "pendiente"
ESTADO_APROBADA = "aprobada"
ESTADO_RECHAZADA = "rechazada"
# Estaba aprobado, pero cambió la referencia del ingrediente (o su rótulo) y
# la comparación empeoró: hay que volver a revisarlo antes de recibir lotes.
ESTADO_REQUIERE_REVISION = "requiere_revision"
ESTADOS_HOMOLOGACION = (ESTADO_PENDIENTE, ESTADO_APROBADA, ESTADO_RECHAZADA, ESTADO_REQUIERE_REVISION)


class Insumo(ModeloBase):
    __tablename__ = "insumos"
    __table_args__ = (
        CheckConstraint(
            "estado_homologacion IN ('pendiente', 'aprobada', 'rechazada', 'requiere_revision')",
            name="ck_insumos_estado_homologacion",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    marca: Mapped[str] = mapped_column(String(120), index=True)
    # Para distinguir dos productos de la misma marca (p. ej. "blanco" e "integral").
    descripcion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    codigo_fabricante: Mapped[str | None] = mapped_column(String(60), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Rótulo del fabricante: de dónde salen sus valores (los valores van en
    # `valores_rotulo_insumo`; los alérgenos, en `insumos_alergenos`).
    rotulo_referencia: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Porción (g o ml) por la que el rótulo declara sus valores; NULL = por 100.
    # Los valores se guardan tal como figuran y también convertidos a 100.
    rotulo_porcion: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Homologación contra el ingrediente. Solo un insumo aprobado recibe lotes.
    estado_homologacion: Mapped[str] = mapped_column(
        String(20), default=ESTADO_PENDIENTE, server_default=ESTADO_PENDIENTE, index=True
    )
    # Resultado de la comparación al decidir (apta / observada / rechazada).
    resultado_homologacion: Mapped[str | None] = mapped_column(String(20), nullable=True)
    justificacion_homologacion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    homologado_por_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"), nullable=True)
    homologado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # La comparación tal como estaba al decidir.
    instantanea_homologacion: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    ingrediente: Mapped["Ingrediente"] = relationship(back_populates="insumos")
    homologado_por: Mapped["Personal | None"] = relationship()
    valores_rotulo: Mapped[list["ValorRotuloInsumo"]] = relationship(
        cascade="all, delete-orphan", order_by="ValorRotuloInsumo.nutriente"
    )
    proveedores: Mapped[list["Proveedor"]] = relationship(
        secondary=proveedores_insumos, back_populates="insumos", order_by="Proveedor.nombre"
    )

    @property
    def ingrediente_nombre(self) -> str:
        return self.ingrediente.nombre

    @property
    def nombre(self) -> str:
        """Cómo se muestra: la marca y, si hay, la descripción."""
        return f"{self.marca} · {self.descripcion}" if self.descripcion else self.marca


class ValorRotuloInsumo(ModeloBase):
    """Un nutriente del rótulo del fabricante del insumo.

    `valor_declarado` es el número tal como figura en el rótulo (por la porción
    del insumo, o por 100 si no tiene); `valor_100` es el que se compara.
    """

    __tablename__ = "valores_rotulo_insumo"
    __table_args__ = (
        CheckConstraint("valor_100 >= 0", name="ck_valores_rotulo_insumo_no_negativo"),
        CheckConstraint("valor_declarado >= 0", name="ck_valores_rotulo_insumo_declarado_no_negativo"),
    )

    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="CASCADE"), primary_key=True
    )
    nutriente: Mapped[str] = mapped_column(
        ForeignKey("parametros_nutrientes.clave"), primary_key=True
    )
    valor_declarado: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    valor_100: Mapped[Decimal] = mapped_column(Numeric(14, 4))
