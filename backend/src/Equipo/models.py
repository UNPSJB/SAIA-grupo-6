from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class Equipo(ModeloBase):
    __tablename__ = "equipos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    tipo: Mapped[str] = mapped_column(String(100), nullable=False)

    ubicacion: Mapped[str] = mapped_column(String(100), nullable=False)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Cada cuántos días vence la calibración. Es opcional a propósito: si viene
    # en NULL el endpoint de calibración usa 365 días como valor por defecto.
    frecuencia_calibracion_dias: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )

    planes: Mapped[list["PlanLimpieza"]] = relationship(back_populates="equipo")

    planes_calibracion_mantenimiento: Mapped[
        list["PlanCalibracionMantenimiento"]
    ] = relationship(back_populates="equipo")

    calibraciones: Mapped[list["Calibracion"]] = relationship(back_populates="equipo")


class Calibracion(ModeloBase):
    __tablename__ = "calibraciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"), index=True)

    fecha_realizacion: Mapped[date] = mapped_column(Date)

    # La calcula el backend a partir de `frecuencia_calibracion_dias` del equipo.
    proximo_vencimiento: Mapped[date] = mapped_column(Date)

    # Relativa a la carpeta de uploads, que se sirve por /uploads exigiendo sesión.
    certificado_url: Mapped[str] = mapped_column(String(255))

    equipo: Mapped["Equipo"] = relationship(back_populates="calibraciones")