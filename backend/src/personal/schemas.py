import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from src.personal import exceptions

class PersonaBase(BaseModel):
    nombre: str 
    apellido: Optional[str] = None
    dni: str 
    telefono: Optional[str] = None
    email: str 
    
    puede_operar: bool = False
    puede_administrar: bool = False

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip() or not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$", v):
            raise exceptions.NombreInvalido()
        return v.strip()

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: str) -> str:
        if not v.strip() or not re.match(r"^\d{7,8}$", v):
            raise exceptions.DniInvalido()
        return v.strip()

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str) -> str:
        if not v.strip() or not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", v):
            raise exceptions.EmailInvalido()
        return v.strip()

class PersonaCreate(PersonaBase):
    pass

class PersonaUpdate(PersonaBase):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    puede_operar: Optional[bool] = None
    puede_administrar: Optional[bool] = None
    activo: Optional[bool] = None

class Persona(PersonaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)