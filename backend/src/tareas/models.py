from datetime import datetime, date
from typing import Optional
from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Date, DateTime
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Tarea(ModeloBase):
    __tablename__ = "tareas"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    

    planes: Mapped[list["PlanLimpieza"]] = relationship(
        back_populates="tarea"
    )