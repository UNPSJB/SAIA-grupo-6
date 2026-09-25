from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

#from src.database import Base aber si esto es lo q no anda
from src.models import ModeloBase


class Equipo(ModeloBase):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key= True, index=True)

    nombre: Mapped[str] = mapped_column(String(100), nullable=False)

    tipo: Mapped[str] = mapped_column(String(100), nullable = False)

    ubicacion: Mapped[str] = mapped_column(String(100), nullable=False)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    planes: Mapped[list["PlanLimpieza"]] = relationship(back_populates="equipo")