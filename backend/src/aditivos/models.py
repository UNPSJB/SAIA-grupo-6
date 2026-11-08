from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class ClaseFuncional(ModeloBase):
    """Clase funcional de un aditivo (conservante, colorante, aromatizante...).

    Es una lista de referencia que se actualiza desde la app. `ins_opcional`
    marca las clases que se declaran solo por su función (aromatizantes).
    """

    __tablename__ = "clases_funcionales"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    ins_opcional: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Aditivo(ModeloBase):
    """Aditivo de la lista de referencia: clase funcional, nombre completo e INS.

    El mismo INS puede aparecer en más de una clase (el ácido cítrico es
    acidulante y antioxidante), por eso lo único es (clase, nombre).
    """

    __tablename__ = "aditivos"
    __table_args__ = (
        UniqueConstraint("clase_funcional_id", "nombre", name="uq_aditivos_clase_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    clase_funcional_id: Mapped[int] = mapped_column(
        ForeignKey("clases_funcionales.id", ondelete="RESTRICT"), index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), index=True)
    numero_ins: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    clase_funcional: Mapped["ClaseFuncional"] = relationship()
