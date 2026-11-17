from typing import Literal
from pydantic import BaseModel, ConfigDict, field_validator
from src.common.paginacion import Pagina
from src.common.validators import texto_obligatorio, texto_no_vacio
from src.unidadMedida import exceptions


TipoUnidadMedida = Literal["masa", "volumen", "unidad"]


class UnidadMedidaBase(BaseModel):
    nombre: str
    simbolo: str
    tipo: TipoUnidadMedida = "unidad"
    factor_a_base: float = 1.0

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return texto_obligatorio(
            v,
            vacio=exceptions.NombreVacio,
            invalido=exceptions.NombreInvalido,
            exigir_alfabetico=True,
        )

    @field_validator("simbolo")
    @classmethod
    def validar_simbolo(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return texto_no_vacio(v, vacio=exceptions.SimboloVacio).upper()

    @field_validator("factor_a_base")
    @classmethod
    def validar_factor_a_base(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v <= 0:
            raise exceptions.FactorInvalido()
        return v


class UnidadMedidaCreate(UnidadMedidaBase):
    pass


class UnidadMedidaUpdate(UnidadMedidaBase):
    """Ensancha la base para heredar sus validadores (que toleran `None`)."""

    nombre: str | None = None
    simbolo: str | None = None
    tipo: TipoUnidadMedida | None = None
    factor_a_base: float | None = None
    activo: bool | None = None


class UnidadMedidaResponse(UnidadMedidaBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class UnidadMedidaPagina(Pagina[UnidadMedidaResponse]):
    """Página de unidades de medida: la respuesta del listado paginado."""

    pass
