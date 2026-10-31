from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
from src.common.paginacion import Pagina
from src.common.validators import (
    RE_NOMBRE_SOLO_LETRAS,
    dni_valido,
    email_valido,
    texto_obligatorio,
)
from src.personal import exceptions


class PersonaCamposValidos(BaseModel):
    """Campos comunes a `PersonaBase` y `PersonaUpdate`, con sus validadores.

    Es un mixin aparte, y no la base de la que hereda `PersonaUpdate`, por dos
    razones:

    1. La regla de "al menos una capacidad" (`model_validator`) solo tiene
       sentido al crear. Si viviera en `PersonaBase`, `PersonaUpdate` la
       heredaría y un PUT parcial —o un PUT que baje un flag a `False`— se
       rechazaría a sí mismo.
    2. Los validadores toleran `None` a propósito: en un PUT un `null`
       explícito llega al validador, y si no se contempla `v.strip()` explota
       con `AttributeError`, que Pydantic no convierte y sale como 500.

    Los campos se declaran acá (opcionales) para que Pydantic pueda asociar
    cada `@field_validator` con su campo; `PersonaBase` los vuelve a declarar
    como obligatorios.
    """

    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return texto_obligatorio(
            v, invalido=exceptions.NombreInvalido, patron=RE_NOMBRE_SOLO_LETRAS
        )

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: Optional[str]) -> Optional[str]:
        return dni_valido(v, invalido=exceptions.DniInvalido)

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: Optional[str]) -> Optional[str]:
        return email_valido(v, invalido=exceptions.EmailInvalido)

def _validar_password(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    # bcrypt 5 limita la contraseña a 72 bytes UTF-8 (no 72 caracteres).
    # Validarlo aquí evita que el hash falle con un error 500 al guardar.
    longitud_bytes = len(v.encode("utf-8"))
    if len(v) < 8 or longitud_bytes > 72:
        raise exceptions.PasswordInvalida(
            "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes UTF-8."
        )
    return v


class PersonaBase(PersonaCamposValidos):
    nombre: str
    dni: str
    email: str
    puede_operar: bool = False
    puede_administrar: bool = False
    es_super_admin: bool = False

class PersonaCreate(PersonaBase):
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v):
        return _validar_password(v)

    @model_validator(mode="after")
    def validar_capacidades(self):
        if not (self.es_super_admin or self.puede_operar or self.puede_administrar):
            raise ValueError("Debe asignar al menos una capacidad (operar o administrar).")
        return self

class PersonaUpdate(PersonaCamposValidos):
    """Edición parcial. Comparte los validadores de campo con `PersonaBase`
    para que un PUT no pueda meter un DNI inválido ni un nombre vacío."""

    password: Optional[str] = None
    puede_operar: Optional[bool] = None
    puede_administrar: Optional[bool] = None
    es_super_admin: Optional[bool] = None
    activo: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v):
        return _validar_password(v)

class Persona(PersonaBase):
    id: int
    activo: bool
    debe_cambiar_password: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None
    password_temporal: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PersonaPagina(Pagina["Persona"]):
    """Página de personal: la respuesta del listado paginado en el servidor."""

    pass
    
class LoginRequest(BaseModel):
    dni: str
    password: str = Field(min_length=1)
