from datetime import datetime, date
from typing import Optional
from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Date, DateTime
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship


class PlanLimpieza(ModeloBase):
    __tablename__ = "plan_limpieza"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"))
    autor_id: Mapped[int] = mapped_column(ForeignKey("personal.id"))

    # Relación 1-N: cada tarea es propia de este plan (no se comparte entre
    # planes). Si se borra el plan, se borran sus tareas con él.
    tareas: Mapped[list["Tarea"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    equipo: Mapped["Equipo"] = relationship(back_populates="planes")
    autor: Mapped["Personal"] = relationship(back_populates="planes")

    # - Opcional , esta bueno
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=datetime.now)
