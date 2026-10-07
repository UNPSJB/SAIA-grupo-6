from pydantic import BaseModel, ConfigDict, field_validator
from src.common.validators import texto_obligatorio
from src.aptitud import exceptions


class AptitudBase(BaseModel):
    nombre: str
    descripcion: str | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return texto_obligatorio(
            v, vacio=exceptions.NombreVacio, invalido=exceptions.NombreInvalido
        )


class AptitudCreate(AptitudBase):
    pass


class AptitudUpdate(AptitudBase):
    """Ensancha la base para heredar sus validadores (que toleran `None`)."""

    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None


class AptitudResponse(AptitudBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)