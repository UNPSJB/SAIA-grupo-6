import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional
from datetime import datetime
from src.PlanLimpieza import exceptions
from src.tareas.schemas import TareaBase as TareaInput, Tarea as TareaSchema


class PlanLimpiezaBase(BaseModel):
    nombre: str
    frecuencia: int
    # Las tareas se crean junto con el plan: acá no se referencian tareas
    # existentes por id (ya no hay catálogo compartido), se manda el nombre
    # de cada tarea nueva que va a pertenecer a este plan.
    tareas: List[TareaInput]
    equipo_id: int
    autor_id: int

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

    @field_validator("tareas")
    @classmethod
    def validar_tareas(cls, v: List[TareaInput]) -> List[TareaInput]:
        if not v:
            raise exceptions.TareasVacias()
        return v

    @field_validator("equipo_id")
    @classmethod
    def validar_equipo_id(cls, v: int) -> int:
        if v <= 0:
            raise exceptions.EquipoIdInvalido()
        return v

    @field_validator("autor_id")
    @classmethod
    def validar_autor_id(cls, v: int) -> int:
        if v <= 0:
            raise exceptions.AutorIdInvalido()
        return v


class PlanLimpiezaCreate(PlanLimpiezaBase):
    pass


class PlanLimpiezaUpdate(PlanLimpiezaBase):
    nombre: Optional[str] = None
    frecuencia: Optional[int] = None
    tareas: Optional[List[TareaInput]] = None
    equipo_id: Optional[int] = None
    autor_id: Optional[int] = None
    activo: Optional[bool] = None


class PlanLimpieza(BaseModel):
    id: int
    nombre: str
    frecuencia: int
    tareas: List[TareaSchema]
    equipo_id: int
    autor_id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
