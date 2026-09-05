from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import auto, StrEnum
from src.models import ModeloBase

class TipoUnidad(StrEnum):
    Kg = auto()
    G = auto()
    L = auto()
    Ml = auto()
    Cm3 = auto()
    


class Insumo(ModeloBase):
    __tablename__ = "insumos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True, unique=True) #por defecto las columnas son not null en sqlAlchemy
    tipo: Mapped[TipoUnidad] = mapped_column() #ver si va index

