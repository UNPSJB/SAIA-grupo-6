from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.common.validators import (
    RE_NOMBRE_SOLO_LETRAS,
    id_positivo,
    texto_obligatorio,
    texto_opcional,
)
from src.tareas import exceptions
from src.tareas.constants import TipoTarea


class TareaBase(BaseModel):
    nombre: str
    frecuencia: int
    tipo: str
    descripcion: Optional[str] = None
    observaciones: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return texto_obligatorio(
            v, invalido=exceptions.NombreInvalido, patron=RE_NOMBRE_SOLO_LETRAS
        )

    @field_validator("frecuencia")
    @classmethod
    def validar_frecuencia(cls, v: Optional[int]) -> Optional[int]:
        return id_positivo(v, invalido=exceptions.FrecuenciaInvalida)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: Optional[str]) -> Optional[str]:
        # En el update el campo es opcional: si no viene, no se valida.
        if v is None:
            return v
        if v not in {t.value for t in TipoTarea}:
            raise exceptions.TipoInvalido()
        return v

    @field_validator("descripcion")
    @classmethod
    def limpiar_descripcion(cls, v: Optional[str]) -> Optional[str]:
        # Texto libre (el procedimiento paso a paso): sin restricción de
        # caracteres, solo recortamos espacios y lo dejamos en None si
        # queda vacío.
        return texto_opcional(v)

    @field_validator("observaciones")
    @classmethod
    def limpiar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        # Texto libre definido por el administrador; mismo criterio que
        # `descripcion`.
        return texto_opcional(v)


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
    tipo: Optional[str] = None
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
