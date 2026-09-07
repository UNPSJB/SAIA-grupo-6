from sqlalchemy import Enum as SQLEnum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from enum import Enum

class TipoEquipo(str, Enum):
    HELADERA = "heladera"
    HORNO = "horno"
    BALANZA = "balanza"
    TERMOMETRO = "termometro"

class Equipo(Base):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key= True, Index=True)

    nombre: Mapped[str] = mapped_column(String(100), nullable=False)

    tipo: Mapped[TipoEquipo] = mapped_column(SQLEnum(TipoEquipo), nullable = False)

    ubicacion: Mapped[str] = mapped_column(String(100), nullable=False)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)