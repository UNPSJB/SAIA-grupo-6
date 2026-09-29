from enum import Enum
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase
from src.unidadMedida.models import UnidadMedida


class TipoQuimico(str, Enum):
    DETERGENTE = "detergente"
    DESINFECTANTE = "desinfectante"
    DESENGRASANTE = "desengrasante"
    SANITIZANTE = "sanitizante"


class InsumoQuimico(ModeloBase):
    __tablename__ = "insumos_quimicos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    tipo: Mapped[TipoQuimico] = mapped_column()
    unidad_medida_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    unidad_medida: Mapped["UnidadMedida"] = relationship()
