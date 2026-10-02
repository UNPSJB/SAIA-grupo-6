from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.models import ModeloBase


class Incidente(ModeloBase):
    __tablename__ = "incidentes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    equipo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipos.id"), nullable=True)
    foto_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)
    fecha_reporte: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    equipo: Mapped[Optional["Equipo"]] = relationship()
    usuario: Mapped["Personal"] = relationship()
