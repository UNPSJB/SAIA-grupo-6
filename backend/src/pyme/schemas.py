from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ConfiguracionPymeUpdate(BaseModel):
    """Actualización parcial: solo se aplican los campos enviados."""

    razon_social: Optional[str] = Field(None, max_length=200)
    domicilio: Optional[str] = Field(None, max_length=300)
    telefono: Optional[str] = Field(None, max_length=80)
    email: Optional[str] = Field(None, max_length=200)
    web: Optional[str] = Field(None, max_length=200)
    rnpa_rppa: Optional[str] = Field(None, max_length=100)


class ConfiguracionPymeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    razon_social: Optional[str] = None
    domicilio: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    web: Optional[str] = None
    rnpa_rppa: Optional[str] = None
    logo_url: Optional[str] = None
