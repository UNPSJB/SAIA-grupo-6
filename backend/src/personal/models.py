from datetime import datetime, date
from typing import Optional
from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Date, DateTime

class Persona(ModeloBase):
    __tablename__ = "personal"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(40),index=True)
    apellido: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    dni: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    email: Mapped[str] = mapped_column(String(60), unique=True, index=True)

    puede_operar: Mapped[bool] = mapped_column(Boolean, default=False)
    puede_administrar: Mapped[bool] = mapped_column(Boolean, default=False)
    # - Para poder hacer las bajas logicas
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # - Opcional , esta bueno
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=datetime.now)

    # - A futuro la entidad tendria una conexion con documentos, los cuales seran otra tabla aparte
    # - Y seria una relacion de uno a muchos, la cual condicionaria si el personal puede operar y si puede administrar.
    # - documentos: Mapped[Optional[List["Documento"]]] = relationship("Documento", back_populates="persona")