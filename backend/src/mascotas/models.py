from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from enum import auto, StrEnum
from src.models import ModeloBase

class TipoMascota(StrEnum):
    GATO = auto()
    PERRO = auto()
    CONEJO = auto()
    COBAYO = auto()
    PEZ = auto()


class Mascota(ModeloBase):
    __tablename__ = "mascotas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(index=True)
    tipo: Mapped[TipoMascota] = mapped_column()  # ej.: "Gato", "Perro", etc.
    tutor_id: Mapped[int] = mapped_column(
        ForeignKey("personas.id")
    )  # Foreign key a Persona
    tutor: Mapped["src.personas.models.Persona"] = relationship(
        "src.personas.models.Persona", back_populates="mascotas"
    )

    @property
    def nombre_tutor(self):
        return self.tutor.nombre
