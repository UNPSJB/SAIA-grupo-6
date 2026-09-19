import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from src.PlanLimpieza import exceptions


class PlanLimpiezaBase(BaseModel):
    nombre: str
    frecuencia: int
    tarea_id: int
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

    @field_validator("tarea_id")
    @classmethod
    def validar_tarea_id(cls, v: int) -> int:
        if v <= 0:
            raise exceptions.TareaIdInvalido()
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
    tarea_id: Optional[int] = None
    equipo_id: Optional[int] = None
    autor_id: Optional[int] = None
    activo: Optional[bool] = None


class PlanLimpieza(PlanLimpiezaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)