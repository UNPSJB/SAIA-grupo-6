from pydantic import BaseModel, ConfigDict, field_validator

from src.common.validators import texto_no_vacio
from src.proveedores import exceptions


class ProveedorBase(BaseModel):
    nombre: str
    matricula: str

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)

    @field_validator("matricula")
    @classmethod
    def validar_matricula(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.MatriculaVacia)


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(ProveedorBase):
    """Ensancha la base para heredar los validadores de campos opcionales."""

    nombre: str | None = None
    matricula: str | None = None
    activo: bool | None = None


class ProveedorResponse(ProveedorBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)
