import re
from pydantic import BaseModel, ConfigDict, field_validator
from src.unidadMedida import exceptions


class UnidadMedidaBase(BaseModel):
    nombre: str
    simbolo: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.NombreVacio()
        if not re.match(r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$", texto) or not re.search(r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]", texto):
            raise exceptions.NombreInvalido()
        return texto

    @field_validator("simbolo")
    @classmethod
    def validar_simbolo(cls, v: str) -> str:
        texto = v.strip().upper()
        if not texto:
            raise exceptions.SimboloVacio()
        return texto


class UnidadMedidaCreate(UnidadMedidaBase):
    pass


class UnidadMedidaUpdate(BaseModel):
    nombre: str | None = None
    simbolo: str | None = None
    activo: bool | None = None


class UnidadMedidaResponse(UnidadMedidaBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)
