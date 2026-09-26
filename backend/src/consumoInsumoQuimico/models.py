from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class ConsumoInsumoQuimico(ModeloBase):
    __tablename__ = "consumos_insumos_quimicos"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    registro_tarea_id: Mapped[int] = mapped_column(
        ForeignKey(
            "registro_tareas.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    insumo_quimico_id: Mapped[int] = mapped_column(
        ForeignKey("insumos_quimicos.id"),
        nullable=False,
        index=True
    )

    cantidad: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    fecha: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        nullable=False
    )

    registro_tarea = relationship("RegistroTarea")

    insumo_quimico = relationship("InsumoQuimico")