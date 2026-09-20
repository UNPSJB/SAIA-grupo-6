from src.models import ModeloBase
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, ForeignKey


class Tarea(ModeloBase):
    __tablename__ = "tareas"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Cada tarea pertenece a un único plan de limpieza (composición, no
    # catálogo compartido). Si se borra el plan, se borran sus tareas
    # (ver cascade="all, delete-orphan" en PlanLimpieza.tareas).
    plan_limpieza_id: Mapped[int] = mapped_column(ForeignKey("plan_limpieza.id"))
    plan: Mapped["PlanLimpieza"] = relationship(back_populates="tareas")
