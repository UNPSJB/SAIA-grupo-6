from sqlalchemy import String, Boolean, CheckConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase


class UnidadMedida(ModeloBase):
    __tablename__ = "unidades_medida"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('masa', 'volumen', 'unidad')",
            name="ck_unidades_medida_tipo",
        ),
        CheckConstraint(
            "factor_a_base > 0",
            name="ck_unidades_medida_factor_a_base_positivo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    simbolo: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    tipo: Mapped[str] = mapped_column(String(10), nullable=False, default="unidad")
    factor_a_base: Mapped[float] = mapped_column(
        Numeric(10, 4), nullable=False, default=1.0
    )
