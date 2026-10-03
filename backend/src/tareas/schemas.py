import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.tareas import exceptions


class TareaBase(BaseModel):
    nombre: str
    frecuencia: int
    descripcion: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip() or not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$", v):
            raise exceptions.NombreInvalido()
        return v.strip()

    @field_validator("frecuencia")
    @classmethod
    def validar_frecuencia(cls, v: int) -> int:
        if v <= 0:
            raise exceptions.FrecuenciaInvalida()
        return v

    @field_validator("descripcion")
    @classmethod
    def limpiar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        # Texto libre (el procedimiento paso a paso): sin restricción de
        # caracteres, solo recortamos espacios y lo dejamos en None si
        # queda vacío.
        if v is None:
            return v
        v = v.strip()
        return v or None


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
    frecuencia: Optional[int] = None
    activo: Optional[bool] = None


class Tarea(TareaBase):
    id: int
    activo: bool
    plan_limpieza_id: int

    model_config = ConfigDict(from_attributes=True)

class TareaEnPlanInput(TareaBase):
    """Igual que TareaBase, pero con id opcional para usar dentro de
    PlanLimpiezaUpdate.tareas: id=None significa 'tarea nueva a crear',
    id=<n> significa 'actualizar la tarea existente con ese id' (en vez
    de matchear por nombre, que rompe la identidad de la tarea si se
    renombra)."""

    id: Optional[int] = None
