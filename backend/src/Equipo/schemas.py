from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator
from src.common.validators import texto_no_vacio
from src.Equipo import exceptions


class EquipoBase(BaseModel):
    nombre: str
    ubicacion: str
    tipo: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        # Corre también en EquipoUpdate, donde los campos son opcionales.
        if v is None:
            return v
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

    @field_validator("ubicacion")
    @classmethod
    def validar_ubicacion_no_vacia(cls, v: str | None) -> str | None:
        return texto_no_vacio(v, vacio=exceptions.UbicacionVacia)

    @field_validator("tipo")
    @classmethod
    def validar_tipo_no_vacia(cls, v: str | None) -> str | None:
        return texto_no_vacio(v, vacio=exceptions.TipoVacio)


class EquipoCreate(EquipoBase):
    pass


class EquipoUpdate(EquipoBase):
    nombre: str | None = None
    ubicacion: str | None = None
    tipo: str | None = None
    activo: bool | None = None    


class EquipoResponse(EquipoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class CalibracionResponse(BaseModel):
    """Una calibración registrada, para el historial del equipo."""

    id: int
    fecha_realizacion: date
    proximo_vencimiento: date
    # Relativa a la carpeta de uploads: el frontend la pide por /uploads, que
    # exige sesión.
    certificado_url: str

    model_config = ConfigDict(from_attributes=True)