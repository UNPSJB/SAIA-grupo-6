from datetime import date
from typing import Optional
from sqlalchemy import String, Boolean, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase

class Equipo(ModeloBase):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    tipo: Mapped[str] = mapped_column(String(60))
    ubicacion: Mapped[str] = mapped_column(String(60))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    planes_calibracion_mantenimiento: Mapped[list["PlanCalibracionMantenimiento"]] = relationship(
        back_populates="equipo"
    )

class Calibracion(ModeloBase):
    __tablename__ = "calibraciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"))
    fecha_realizacion: Mapped[date] = mapped_column(Date)
    proximo_vencimiento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    certificado_url: Mapped[str] = mapped_column(String(255))