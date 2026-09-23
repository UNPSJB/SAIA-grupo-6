from enum import Enum
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from src.models import ModeloBase

class TipoQuimico(str, Enum):
    DETERGENTE = "detergente"
    DESINFECTANTE = "desinfectante"
    DESENGRASANTE = "desengrasante"
    SANITIZANTE = "sanitizante"

class UnidadMedidaQuimico(str, Enum):
    LITRO = "l"
    MILILITRO = "ml"
    KILOGRAMO = "kg"
    GRAMO = "g"
    DOSIS = "dosis"

class InsumoQuimico(ModeloBase):
    __tablename__ = "insumos_quimicos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    tipo: Mapped[TipoQuimico] = mapped_column()
    unidad_medida: Mapped[UnidadMedidaQuimico] = mapped_column()
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

