from typing import Optional, List
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase


class Persona(ModeloBase):
    __tablename__ = "personas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    mascotas: Mapped[Optional[List["src.mascotas.models.Mascota"]]] = relationship(
        "src.mascotas.models.Mascota", back_populates="tutor"
    )
