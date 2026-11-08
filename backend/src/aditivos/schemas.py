from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.aditivos import exceptions
from src.aditivos.constants import RE_NUMERO_INS
from src.common.validators import texto_no_vacio


def _normalizar_ins(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = valor.strip().lower().replace(" ", "").removeprefix("ins")
    if not limpio:
        return None
    if not RE_NUMERO_INS.match(limpio):
        raise exceptions.InsInvalido()
    return limpio


class ClaseFuncionalCreate(BaseModel):
    nombre: str = Field(max_length=80)
    ins_opcional: bool = False

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class ClaseFuncionalUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    ins_opcional: bool | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else texto_no_vacio(valor, vacio=exceptions.NombreVacio)


class ClaseFuncionalResponse(BaseModel):
    id: int
    nombre: str
    ins_opcional: bool
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class AditivoCreate(BaseModel):
    clase_funcional_id: int = Field(gt=0)
    nombre: str = Field(max_length=150)
    numero_ins: str | None = Field(default=None, max_length=20)

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.NombreVacio)

    @field_validator("numero_ins")
    @classmethod
    def validar_ins(cls, valor: str | None) -> str | None:
        return _normalizar_ins(valor)


class AditivoUpdate(BaseModel):
    clase_funcional_id: int | None = Field(default=None, gt=0)
    nombre: str | None = Field(default=None, max_length=150)
    numero_ins: str | None = Field(default=None, max_length=20)
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else texto_no_vacio(valor, vacio=exceptions.NombreVacio)

    @field_validator("numero_ins")
    @classmethod
    def validar_ins(cls, valor: str | None) -> str | None:
        return _normalizar_ins(valor)


class AditivoResponse(BaseModel):
    id: int
    nombre: str
    numero_ins: str | None
    activo: bool
    clase_funcional: ClaseFuncionalResponse

    model_config = ConfigDict(from_attributes=True)


class AditivoResumen(BaseModel):
    """Lo que se muestra de un aditivo dentro de un insumo o una receta."""

    id: int
    nombre: str
    numero_ins: str | None
    clase_funcional: str
