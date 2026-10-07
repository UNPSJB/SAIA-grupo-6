from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional
from datetime import datetime
from src.common.validators import (
    RE_NOMBRE_SOLO_LETRAS,
    id_positivo,
    texto_obligatorio,
)
from src.PlanLimpieza import exceptions
from src.tareas.schemas import TareaBase as TareaInput, TareaEnPlanInput, Tarea as TareaSchema


class PlanLimpiezaBase(BaseModel):
    nombre: str
    # Las tareas se crean junto con el plan: acá no se referencian tareas
    # existentes por id (ya no hay catálogo compartido), se manda el nombre
    # y la frecuencia de cada tarea nueva que va a pertenecer a este plan.
    tareas: List[TareaInput]
    equipo_id: int
    autor_id: int

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return texto_obligatorio(
            v, invalido=exceptions.NombreInvalido, patron=RE_NOMBRE_SOLO_LETRAS
        )

    @field_validator("tareas")
    @classmethod
    def validar_tareas(cls, v: Optional[List[TareaInput]]) -> Optional[List[TareaInput]]:
        if v is not None and not v:
            raise exceptions.TareasVacias()
        return v

    @field_validator("equipo_id")
    @classmethod
    def validar_equipo_id(cls, v: Optional[int]) -> Optional[int]:
        return id_positivo(v, invalido=exceptions.EquipoIdInvalido)

    @field_validator("autor_id")
    @classmethod
    def validar_autor_id(cls, v: Optional[int]) -> Optional[int]:
        return id_positivo(v, invalido=exceptions.AutorIdInvalido)


class PlanLimpiezaCreate(PlanLimpiezaBase):
    pass


class PlanLimpiezaUpdate(PlanLimpiezaBase):
    nombre: Optional[str] = None
    tareas: Optional[List[TareaEnPlanInput]] = None
    equipo_id: Optional[int] = None
    autor_id: Optional[int] = None
    activo: Optional[bool] = None


class PlanLimpieza(BaseModel):
    id: int
    nombre: str
    tareas: List[TareaSchema]
    equipo_id: int
    autor_id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
