from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.aditivos import exceptions
from src.aditivos.constants import RE_NUMERO_INS
from src.common.validators import texto_no_vacio


def normalizar_ins(valor: str | None) -> str | None:
    """"INS 500 (ii)" -> "500(ii)". Vacío -> None. Formato inválido -> error."""
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


class SugerenciaAditivo(BaseModel):
    """Una entrada de la lista de referencia, para completar un ingrediente aditivo."""

    nombre: str
    numero_ins: str | None
    clase_funcional: str
    # None si la clase no existe o está dada de baja en la app.
    clase_funcional_id: int | None


class AditivoResumen(BaseModel):
    """Lo que se muestra de un ingrediente aditivo dentro de un listado o una receta."""

    id: int
    nombre: str
    numero_ins: str | None
    clase_funcional: str
    ins_opcional: bool = False
