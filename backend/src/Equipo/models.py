from sqlalchemy import Boolean, Enum as SQLEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

#from src.database import Base aber si esto es lo q no anda
from enum import Enum
from src.models import ModeloBase

class TipoEquipo(str, Enum):
    HELADERA = "heladera"
    HORNO = "horno"
    BALANZA = "balanza"
    TERMOMETRO = "termometro"

class Equipo(ModeloBase):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key= True, index=True)

    nombre: Mapped[str] = mapped_column(String(100), nullable=False)

    tipo: Mapped[TipoEquipo] = mapped_column(SQLEnum(TipoEquipo), nullable = False)

    ubicacion: Mapped[str] = mapped_column(String(100), nullable=False)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)