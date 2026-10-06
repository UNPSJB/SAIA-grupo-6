from datetime import date, datetime
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.aptitud.models import Aptitud
from src.personal.models import Personal
from src.models import ModeloBase


class VencimientoPersonal(ModeloBase):
    __tablename__ = "vencimientos_personal"
    __table_args__ = (
        UniqueConstraint("persona_id", "aptitud_id", name="uq_vencimiento_persona_aptitud"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    persona_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), index=True)
    aptitud_id: Mapped[int] = mapped_column(ForeignKey("aptitudes.id"), index=True)
    fecha_vencimiento: Mapped[date] = mapped_column(Date)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.now
    )

    persona: Mapped["Personal"] = relationship()
    aptitud: Mapped["Aptitud"] = relationship()