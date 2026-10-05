from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class PlanCalibracionMantenimiento(ModeloBase):
    __tablename__ = "planes_calibracion_mantenimiento"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"), index=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    fecha_ultima_intervencion: Mapped[date] = mapped_column(Date, nullable=False)
    periodicidad_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.now
    )

    equipo: Mapped["Equipo"] = relationship(
        back_populates="planes_calibracion_mantenimiento"
    )
    autor: Mapped["Personal"] = relationship()

    @property
    def proxima_fecha_vencimiento(self) -> date:
        return self.fecha_ultima_intervencion + timedelta(days=self.periodicidad_dias)

    @property
    def dias_restantes(self) -> int:
        return (self.proxima_fecha_vencimiento - date.today()).days
