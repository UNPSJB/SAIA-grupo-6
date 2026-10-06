from pydantic import BaseModel, ConfigDict, field_validator
from src.common.validators import texto_obligatorio, texto_no_vacio
from src.unidadMedida import exceptions


class UnidadMedidaBase(BaseModel):
    nombre: str
    simbolo: str

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


class UnidadMedidaCreate(UnidadMedidaBase):
    pass


class UnidadMedidaUpdate(UnidadMedidaBase):
    """Ensancha la base para heredar sus validadores (que toleran `None`)."""

    nombre: str | None = None
    simbolo: str | None = None
    activo: bool | None = None


class UnidadMedidaResponse(UnidadMedidaBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)
