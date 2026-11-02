from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase
from src.unidadMedida.models import UnidadMedida

TIPO_INSUMO = "insumo"
TIPO_PRODUCTO = "producto"
TIPOS_INSUMO = (TIPO_INSUMO, TIPO_PRODUCTO)


class Insumo(ModeloBase):
    __tablename__ = "insumos"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('insumo', 'producto')",
            name="ck_insumos_tipo_valido",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True, unique=True)
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(default=True)
    tipo: Mapped[str] = mapped_column(
        String(20),
        default=TIPO_INSUMO,
        server_default=TIPO_INSUMO,
        index=True,
    )

    unidad_medida: Mapped["UnidadMedida"] = relationship()

