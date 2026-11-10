from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator

from src.common.validators import cuit_valido, email_valido, texto_obligatorio, texto_opcional
from src.transportistas import exceptions


class TransportistaBase(BaseModel):
    razon_social: str
    cuit: str
    telefono: str
    email: str | None = None
    domicilio: str | None = None
    observaciones: str | None = None

    @field_validator("razon_social")
    @classmethod
    def validar_razon_social(cls, valor: str | None) -> str | None:
        return texto_obligatorio(
            valor,
            invalido=exceptions.RazonSocialVacia,
            vacio=exceptions.RazonSocialVacia,
        )

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, valor: str | None) -> str | None:
        return cuit_valido(
            valor,
            invalido=exceptions.CuitInvalido,
        )

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, valor: str | None) -> str | None:
        return texto_obligatorio(
            valor,
            invalido=exceptions.TelefonoVacio,
            vacio=exceptions.TelefonoVacio,
        )

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        return email_valido(
            valor,
            invalido=exceptions.EmailInvalido,
        )

    @field_validator("domicilio")
    @classmethod
    def validar_domicilio(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)

    @field_validator("observaciones")
    @classmethod
    def validar_observaciones(cls, valor: str | None) -> str | None:
        return texto_opcional(valor)


class TransportistaCreate(TransportistaBase):
    pass


class TransportistaUpdate(TransportistaBase):
    """Ensancha la base para heredar los validadores de campos opcionales."""

    razon_social: str | None = None
    cuit: str | None = None
    telefono: str | None = None
    email: str | None = None
    domicilio: str | None = None
    observaciones: str | None = None
    activo: bool | None = None


class TransportistaResponse(TransportistaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
