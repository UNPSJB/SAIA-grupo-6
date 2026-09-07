from pydantic import BaseModel, ConfigDict, field_validator, Field
from src.Equipo.models import TipoEquipo
from src.Equipo import exceptions


class EquipoBase(BaseModel):
    nombre: str
    ubicacion: str
    tipo: TipoEquipo

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

    @field_validator("tipo", mode="before")
    @classmethod
    def is_valid_tipo_unidad(cls, v: str) -> str:
        tipos_validos = [tipo.value for tipo in TipoEquipo]

        if v.lower() not in tipos_validos:
            raise exceptions.TipoUnidadInvalido(tipos_validos)

        return v.lower()



class EquipoCreate(EquipoBase):
    pass


class EquipoUpdate(EquipoBase):
    pass


class Equipo(EquipoBase):
    id: int
    tipo: TipoEquipo

    model_config = ConfigDict(from_attributes = True)


class EquipoDelete(EquipoBase):
    id: int
    tipo: TipoEquipo

class EquipoResponse(EquipoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)