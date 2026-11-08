from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.aditivos.models import Aditivo
from src.models import ModeloBase
from src.unidadMedida.models import UnidadMedida

# Tipo del insumo (E9). Antes era insumo/producto: los productos tienen su
# propia tabla desde la trazabilidad (ver migrations/insumos_tipo.py).
TIPO_INGREDIENTE = "ingrediente"
TIPO_ADITIVO = "aditivo"
TIPOS_INSUMO = (TIPO_INGREDIENTE, TIPO_ADITIVO)


class Insumo(ModeloBase):
    __tablename__ = "insumos"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('ingrediente', 'aditivo')",
            name="ck_insumos_tipo_valido",
        ),
        # Un aditivo siempre apunta a la lista de referencia (clase funcional,
        # nombre completo e INS); un ingrediente nunca.
        CheckConstraint(
            "(tipo = 'aditivo' AND aditivo_id IS NOT NULL) "
            "OR (tipo = 'ingrediente' AND aditivo_id IS NULL)",
            name="ck_insumos_aditivo_segun_tipo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True, unique=True)
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(default=True)
    tipo: Mapped[str] = mapped_column(
        String(20),
        default=TIPO_INGREDIENTE,
        server_default=TIPO_INGREDIENTE,
        index=True,
    )
    aditivo_id: Mapped[int | None] = mapped_column(
        ForeignKey("aditivos.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    unidad_medida: Mapped["UnidadMedida"] = relationship()
    aditivo: Mapped["Aditivo | None"] = relationship()
