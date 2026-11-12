from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio, texto_opcional
from src.productos import exceptions


class UnidadResumen(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)


class ProductoBase(BaseModel):
    nombre: str = Field(max_length=120)
    descripcion: str | None = Field(default=None, max_length=500)
    categoria_rotulado: str | None = Field(default=None, max_length=80)
    categoria_exceptuada_por_ley: bool = False

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=500)


class ProductoCreate(ProductoBase):
    unidad_medida_id: int = Field(gt=0)


class ProductoUpdate(ProductoBase):
    nombre: str | None = Field(default=None, max_length=120)
    unidad_medida_id: int | None = Field(default=None, gt=0)
    activo: bool | None = None
    categoria_exceptuada_por_ley: bool | None = None


class ProductoResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    activo: bool
    categoria_rotulado: str | None
    categoria_exceptuada_por_ley: bool
    unidad_medida: UnidadResumen

    model_config = ConfigDict(from_attributes=True)
