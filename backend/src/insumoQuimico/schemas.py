import re
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from src.insumoQuimico.models import TipoQuimico, UnidadMedidaQuimico
from src.insumoQuimico import exceptions


class InsumoQuimicoBase(BaseModel):
    nombre: str
    tipo: TipoQuimico
    unidad_medida: UnidadMedidaQuimico

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
    unidad_medida: Optional[UnidadMedidaQuimico] = None
    activo: Optional[bool] = None


class InsumoQuimicoResponse(InsumoQuimicoBase):
    id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)