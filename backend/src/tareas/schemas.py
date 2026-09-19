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
    pass


class TareaUpdate(TareaBase):
    nombre: Optional[str] = None
    activo: Optional[bool] = None


class Tarea(TareaBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)
