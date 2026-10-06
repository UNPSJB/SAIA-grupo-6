from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import Optional
from datetime import datetime
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


class PersonaBase(PersonaCamposValidos):
    nombre: str
    dni: str
    email: str

    puede_operar: bool = False
    puede_administrar: bool = False
    es_super_admin: bool = False

    @model_validator(mode='after')
    def validar_capacidades(self):
        if not self.es_super_admin and not self.puede_operar and not self.puede_administrar:
            raise ValueError("Debe asignar al menos una capacidad (operar o administrar).")
        return self

class PersonaCreate(PersonaBase):
    password: str

class PersonaUpdate(PersonaCamposValidos):
    """Edición parcial. Comparte los validadores de campo con `PersonaBase`
    para que un PUT no pueda meter un DNI inválido ni un nombre vacío."""

    password: Optional[str] = None
    puede_operar: Optional[bool] = None
    puede_administrar: Optional[bool] = None
    es_super_admin: Optional[bool] = None
    activo: Optional[bool] = None

class Persona(PersonaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
    
class LoginRequest(BaseModel):
    dni: str
    password: str