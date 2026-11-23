from datetime import datetime

from sqlalchemy import Index, Boolean, CheckConstraint, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.aditivos.models import ClaseFuncional
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento
from src.unidadMedida.models import UnidadMedida


class Ingrediente(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "ingredientes"
    __table_args__ = (
        # Un aditivo siempre tiene clase funcional (el INS puede faltar en
        # las clases que lo admiten, como los aromatizantes); un ingrediente
        # que no es aditivo no tiene ninguno de los dos.
        CheckConstraint(
            "(es_aditivo = 1 AND clase_funcional_id IS NOT NULL) "
            "OR (es_aditivo = 0 AND clase_funcional_id IS NULL AND numero_ins IS NULL)",
            name="ck_ingredientes_aditivo_con_clase",
        ),
        CheckConstraint(
            "evaluacion_alergenos IN ('sin_evaluar', 'incompleta', 'evaluada')",
            name="ck_ingredientes_evaluacion_alergenos",
        ),
        CheckConstraint(
            "gluten IN ('desconocido', 'presente', 'ausencia_declarada')",
            name="ck_ingredientes_gluten",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True)
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(default=True)
    # Todo lo que entra en la receta es un ingrediente (CAA: "incluidos los
    # aditivos"). Esta marca distingue a los aditivos, que se declaran con su
    # clase funcional e INS.
    es_aditivo: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", index=True
    )
    # Solo para aditivos: con qué función y número INS se declaran.
    clase_funcional_id: Mapped[int | None] = mapped_column(
        ForeignKey("clases_funcionales.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    # Único en la sede: el INS identifica al aditivo, y sus marcas van como insumos.
    # Varios ingredientes sin INS (NULL) no chocan.
    numero_ins: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    unidad_medida: Mapped["UnidadMedida"] = relationship()
    clase_funcional: Mapped["ClaseFuncional | None"] = relationship()
    # Las marcas que se compran de este ingrediente.
    insumos: Mapped[list["Insumo"]] = relationship(
        back_populates="ingrediente", order_by="Insumo.marca"
    )
    # Proveedores de alguno de sus insumos. Es de solo lectura: la asociación
    # se carga en cada insumo (`proveedores_insumos`).
    proveedores: Mapped[list["Proveedor"]] = relationship(
        "Proveedor",
        secondary="join(Insumo, proveedores_insumos, Insumo.id == proveedores_insumos.c.insumo_id)",
        primaryjoin="Ingrediente.id == Insumo.ingrediente_id",
        secondaryjoin="Proveedor.id == proveedores_insumos.c.proveedor_id",
        viewonly=True,
        order_by="Proveedor.nombre",
    )

    # Campos opcionales según tipo de unidad de medida:
    #  - volumen -> densidad_g_ml es obligatorio
    #  - unidad  -> peso_unitario_g es obligatorio
    densidad_g_ml: Mapped[float | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    peso_unitario_g: Mapped[float | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )

    # Evaluación de alérgenos (los alérgenos en sí están en
    # `ingredientes_alergenos`). Arma las declaraciones del rótulo: sin
    # evaluar o incompleta las deja pendientes.
    evaluacion_alergenos: Mapped[str] = mapped_column(
        String(20), default="sin_evaluar", server_default="sin_evaluar"
    )
    gluten: Mapped[str] = mapped_column(
        String(20), default="desconocido", server_default="desconocido"
    )
    respaldo_alergenos: Mapped[str | None] = mapped_column(Text, nullable=True)
    observaciones_alergenos: Mapped[str | None] = mapped_column(Text, nullable=True)
    alergenos_actualizado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    alergenos_actualizado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )

    @property
    def aditivo(self) -> dict | None:
        """Resumen para mostrar (clase funcional, nombre e INS), o None si no es aditivo."""
        if not self.es_aditivo or self.clase_funcional is None:
            return None
        return {
            "id": self.id,
            "nombre": self.nombre,
            "numero_ins": self.numero_ins,
            "clase_funcional": self.clase_funcional.nombre,
            "ins_opcional": self.clase_funcional.ins_opcional,
        }


# Únicos por establecimiento: cada sede tiene su propio catálogo, así que dos
# sedes pueden repetir el valor (ver src/establecimientos).
Index("uq_ingredientes_establecimiento_nombre", Ingrediente.establecimiento_id, Ingrediente.nombre, unique=True)
Index("uq_ingredientes_establecimiento_numero_ins", Ingrediente.establecimiento_id, Ingrediente.numero_ins, unique=True)
