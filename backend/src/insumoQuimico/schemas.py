import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from src.insumoQuimico.models import TipoQuimico
from src.insumoQuimico import exceptions


class InsumoQuimicoBase(BaseModel):
    nombre: str
    tipo: TipoQuimico
    unidad_medida_id: int

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        texto = v.strip()

        if not texto:
            raise exceptions.NombreVacio()

        patron = r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$"

        if (
            not re.match(patron, texto)
            or not re.search(
                r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]",
                texto
            )
        ):
            raise exceptions.NombreInvalido()

        return texto


class InsumoQuimicoCreate(InsumoQuimicoBase):
    pass


class InsumoQuimicoUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoQuimico] = None
    unidad_medida_id: Optional[int] = None
    activo: Optional[bool] = None

    # Mismas validaciones que el alta: sin esto se podían guardar nombres
    # vacíos o inválidos que después rompían la serialización de la respuesta.
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None

        texto = v.strip()

        if not texto:
            raise exceptions.NombreVacio()

        patron = r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$"

        if (
            not re.match(patron, texto)
            or not re.search(
                r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]",
                texto
            )
        ):
            raise exceptions.NombreInvalido()

        return texto


class InsumoQuimicoResponse(InsumoQuimicoBase):
    id: int
    activo: bool
    unidad_medida: "UnidadMedidaResponse"

    model_config = ConfigDict(from_attributes=True)


class InsumoQuimicoOpcion(BaseModel):
    """Datos mínimos del producto para seleccionarlo en el checklist."""

    id: int
    nombre: str
    unidad_simbolo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UnidadMedidaResponse(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)