from pydantic import BaseModel, ConfigDict, field_validator
from src.insumos import exceptions


class InsumoBase(BaseModel):
    nombre: str
    unidad_medida_id: int

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()


class InsumoCreate(InsumoBase):
    pass


class InsumoUpdate(BaseModel):
    nombre: str | None = None
    unidad_medida_id: int | None = None
    activo: bool | None = None

    # Igual que el alta: sin esto se podían guardar nombres vacíos al editar.
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if v is None:
            return None
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()


class Insumo(InsumoBase):
    id: int
    activo: bool
    unidad_medida: "UnidadMedidaResponse"

    model_config = ConfigDict(from_attributes=True)


class UnidadMedidaResponse(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)
