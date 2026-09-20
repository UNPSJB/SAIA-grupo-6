import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.tareas import exceptions


class TareaBase(BaseModel):
    nombre: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip() or not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$", v):
            raise exceptions.NombreInvalido()
        return v.strip()


class TareaCreate(TareaBase):
    """Para crear una tarea suelta, agregándola a un plan que ya existe.
    Cuando la tarea nace junto con el plan (alta de PlanLimpieza), se usa
    TareaBase directamente desde src.PlanLimpieza.schemas — ahí todavía no
    hay un plan_limpieza_id porque el plan no fue creado."""

    plan_limpieza_id: int

    @field_validator("plan_limpieza_id")
    @classmethod
    def validar_plan_limpieza_id(cls, v: int) -> int:
        if v <= 0:
            raise exceptions.PlanLimpiezaIdInvalido()
        return v


class TareaUpdate(TareaBase):
    nombre: Optional[str] = None
    activo: Optional[bool] = None


class Tarea(TareaBase):
    id: int
    activo: bool
    plan_limpieza_id: int

    model_config = ConfigDict(from_attributes=True)
