import re
from pydantic import BaseModel, ConfigDict, field_validator
from src.aptitud import exceptions


class AptitudBase(BaseModel):
    nombre: str
    descripcion: str | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.NombreVacio()
        if not re.match(r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$", texto):
            raise exceptions.NombreInvalido()
        return texto


class AptitudCreate(AptitudBase):
    pass


class AptitudUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None


class AptitudResponse(AptitudBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)