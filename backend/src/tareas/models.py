from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, ForeignKey, Integer


class Tarea(ModeloBase):
    __tablename__ = "tareas"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Cada tarea tiene su propia frecuencia (antes vivía en PlanLimpieza):
    # cada N días desde la fecha de creación del plan al que pertenece.
    frecuencia: Mapped[int] = mapped_column(Integer, nullable=False)

    # Cada tarea pertenece a un único plan de limpieza (composición, no
    # catálogo compartido). Si se borra el plan, se borran sus tareas
    # (ver cascade="all, delete-orphan" en PlanLimpieza.tareas).
    plan_limpieza_id: Mapped[int] = mapped_column(ForeignKey("plan_limpieza.id"))
    plan: Mapped["PlanLimpieza"] = relationship(back_populates="tareas")
