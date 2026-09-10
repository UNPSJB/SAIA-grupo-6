from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import date, datetime

# datos comunes y obligatorios
class PersonaBase(BaseModel):
    # primero valido nombre y apellido para que no vengan vacios y estan limitados con un maximo.
    nombre: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    apellido: Optional[str] = Field(default=None, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")

    # valido dni para que tenga una longitud correcta
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    
    telefono: Optional[str] = Field(default=None, max_length=15, pattern=r"^\+?[0-9\s-]+$")

    # EmailStr fuerza a que el texto tenga un @ y un dominio válido
    email: EmailStr

    puede_operar: bool = False
    puede_administrar: bool = False

# ACA LO Q EL FRONTEND ENVIA PARA DAR DE ALTA
class PersonaCreate(PersonaBase):
    pass

# lo que el frontend envía para MODIFICAR
class PersonaUpdate(PersonaBase):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    apellido: Optional[str] = Field(default=None, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    dni: Optional[str] = Field(default=None, min_length=7, max_length=8, pattern=r"^\d+$")
    telefono: Optional[str] = Field(default=None, max_length=15, pattern=r"^\+?[0-9\s-]+$")
    email: Optional[EmailStr] = None
    puede_operar: Optional[bool] = None
    puede_administrar: Optional[bool] = None
    activo: Optional[bool] = None  # Útil si queremos dar la baja lógica desde el frontend

# Lo que la API le DEVUELVE al frontend
class Persona(PersonaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    # from_atributes=True permite que Pydantic trabaje con modelos SQLAlchemy
    model_config = ConfigDict(from_attributes= True)

