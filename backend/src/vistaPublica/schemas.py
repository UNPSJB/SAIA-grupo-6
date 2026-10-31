from typing import Literal, Optional

from pydantic import BaseModel


class ConfiguracionVistaPublicaUpdate(BaseModel):
    habilitada: bool


class ConfiguracionVistaPublicaResponse(BaseModel):
    habilitada: bool
    url_publica: Optional[str] = None


class ValidacionVistaPublicaResponse(BaseModel):
    valida: Literal[True] = True
