from datetime import date
from typing import Optional
from sqlalchemy import String, Boolean, Date, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase

class Equipo(ModeloBase):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), index=True)
    tipo: Mapped[str] = mapped_column(String(50))
    ubicacion: Mapped[str] = mapped_column(String(100))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # --- NUEVO: Frecuencia de calibración ---
    frecuencia_calibracion_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- RELACIONES ---
    # Relación existente con Plan de Limpieza (vital para que el backend no crashee)
    planes: Mapped[list["PlanLimpieza"]] = relationship(back_populates="equipo")
    
    # NUEVA: Relación con el historial de calibraciones
    calibraciones: Mapped[list["Calibracion"]] = relationship(back_populates="equipo")

# --- NUEVA TABLA: Historial de certificados de calibración ---
class Calibracion(ModeloBase):
    __tablename__ = "calibraciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"))
    fecha_realizacion: Mapped[date] = mapped_column(Date)
    proximo_vencimiento: Mapped[date] = mapped_column(Date)
    certificado_url: Mapped[str] = mapped_column(String(255)) 

    equipo: Mapped["Equipo"] = relationship(back_populates="calibraciones")