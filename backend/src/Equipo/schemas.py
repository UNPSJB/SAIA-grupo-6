from pydantic import BaseModel, ConfigDict, field_validator, Field
from src.Equipo import exceptions


class EquipoBase(BaseModel):
    nombre: str
    ubicacion: str
    tipo: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

    @field_validator("ubicacion")
    @classmethod
    def validar_ubicacion_no_vacia(cls, v: str) -> str:
        if not v.strip():
            raise exceptions.UbicacionVacia()
        return v.strip()

    @field_validator("tipo")
    @classmethod
    def validar_tipo_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El tipo de equipo no puede estar vacio.")
        return v.strip()


class EquipoCreate(EquipoBase):
    pass


class EquipoUpdate(EquipoBase):
    nombre: str | None = None
    ubicacion: str | None = None
    tipo: str | None = None
    activo: bool | None = None    


class Equipo(EquipoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes = True)


class EquipoDelete(EquipoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attribute=True)

class EquipoResponse(EquipoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)