from pydantic import BaseModel, ConfigDict, field_validator, Field
from src.insumos.models import TipoUnidad
from src.insumos import exceptions

# Los siguientes schemas contienen atributos sin muchas restricciones de tipo.
# Podemos crear atributos con ciertas reglas mediante el uso de un "Field" adecuado.
# https://docs.pydantic.dev/latest/concepts/fields/


class InsumoBase(BaseModel):
    nombre: str
    tipo: TipoUnidad  # solo permitiremos valores de este tipo.

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v):
        if not v.strip():
            raise exceptions.NombreVacio()
        return v.strip()

    @field_validator("tipo", mode="before")
    @classmethod
    def is_valid_tipo_unidad(cls, v: str) -> str:
        tipos_validos = [tipo.value for tipo in TipoUnidad]

        if v.lower() not in tipos_validos:
            raise exceptions.TipoUnidadInvalido(tipos_validos)

        return v.lower()


class InsumoCreate(InsumoBase):
    pass


class InsumoUpdate(InsumoBase):
    pass


class Insumo(InsumoBase):
    id: int
    tipo: TipoUnidad

    model_config = ConfigDict(from_attributes = True)


class InsumoDelete(InsumoBase):
    id: int
    tipo: TipoUnidad
