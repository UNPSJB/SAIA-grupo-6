from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator

from src.common.validators import documento_valido, email_valido, texto_obligatorio, texto_opcional
from src.clientes import exceptions


class ClienteBase(BaseModel):
    nombre: str
    documento: str
    telefono: str
    email: str | None = None
    domicilio: str | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, valor: str | None) -> str | None:
        return texto_obligatorio(
            valor,
            invalido=exceptions.NombreVacio,
            vacio=exceptions.NombreVacio,
        )

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, valor: str | None) -> str | None:
        return documento_valido(
            valor,
            invalido=exceptions.DocumentoInvalido,
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


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(ClienteBase):
    """Ensancha la base para heredar los validadores de campos opcionales."""

    nombre: str | None = None
    documento: str | None = None
    telefono: str | None = None
    email: str | None = None
    domicilio: str | None = None
    activo: bool | None = None


class ClienteResponse(ClienteBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
