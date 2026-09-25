from datetime import datetime, date
from typing import Optional
from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Date, DateTime, Integer

class ElementoLimpieza(ModeloBase):
    __tablename__ = "elementos_limpieza"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nombre: Mapped[str] = mapped_column(String(40), unique= True, index=False)

    frecuencia_recambio_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    fecha_ultimo_recambio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=True)
