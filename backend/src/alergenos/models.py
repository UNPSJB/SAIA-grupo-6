"""Alérgenos: el catálogo y los que declara cada ingrediente.

Un ingrediente puede *contener* un alérgeno (es parte de su formulación) o
*puede contenerlo* (trazas por contacto cruzado). Se declaran distinto en el
rótulo, por eso se guardan en dos niveles y no en una sola lista.
"""

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class Alergeno(ModeloBase):
    __tablename__ = "alergenos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Identificador estable ("leche", "trigo"): lo guardan las revisiones de
    # las declaraciones del rótulo, que son históricas y no se reescriben.
    codigo: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    # Su declaración depende de una evaluación del producto final (los
    # sulfitos, según su concentración): no se declara solo por estar.
    condicionada: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class IngredienteAlergeno(ModeloBase):
    __tablename__ = "ingredientes_alergenos"
    __table_args__ = (
        CheckConstraint(
            "nivel IN ('contiene', 'puede_contener')", name="ck_ingredientes_alergenos_nivel"
        ),
        # "derivado": lo contiene a través de un derivado (lecitina de soja,
        # suero de leche). Se declara "contiene derivados de". Solo aplica a
        # lo que el ingrediente contiene.
        CheckConstraint(
            "forma = 'directa' OR (forma = 'derivado' AND nivel = 'contiene')",
            name="ck_ingredientes_alergenos_forma",
        ),
    )

    ingrediente_id: Mapped[int] = mapped_column(
        ForeignKey("ingredientes.id", ondelete="CASCADE"), primary_key=True
    )
    alergeno_id: Mapped[int] = mapped_column(
        ForeignKey("alergenos.id", ondelete="RESTRICT"), primary_key=True
    )
    nivel: Mapped[str] = mapped_column(String(20))
    forma: Mapped[str] = mapped_column(String(10), default="directa", server_default="directa")

    alergeno: Mapped["Alergeno"] = relationship()


class InsumoAlergeno(ModeloBase):
    """Alérgeno que declara el rótulo de un insumo (marca).

    Se compara con los del ingrediente al homologar: no tienen tolerancia.
    """

    __tablename__ = "insumos_alergenos"
    __table_args__ = (
        CheckConstraint(
            "nivel IN ('contiene', 'puede_contener')", name="ck_insumos_alergenos_nivel"
        ),
    )

    insumo_id: Mapped[int] = mapped_column(
        ForeignKey("insumos.id", ondelete="CASCADE"), primary_key=True
    )
    alergeno_id: Mapped[int] = mapped_column(
        ForeignKey("alergenos.id", ondelete="RESTRICT"), primary_key=True
    )
    nivel: Mapped[str] = mapped_column(String(20))

    alergeno: Mapped["Alergeno"] = relationship()
