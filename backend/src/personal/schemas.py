from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import date, datetime

# - Datos comunes y obligatorios
class PersonaBase(BaseModel):
    # Se valida nombre y apellido para que no vengan vacios y estan limitados con un maximo.
    nombre: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    apellido: Optional[str] = Field(default=None, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")

    # Se valida dni para que tenga una longitud correcta.
    dni: str = Field(min_length=7, max_length=8, pattern=r"^\d+$")
    fecha_nacimiento: Optional[date] = None

    @field_validator("fecha_nacimiento")
    @classmethod
    def validar_fecha_nacimiento(cls, fecha):
        if fecha and fecha > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura")
        return fecha
    
    telefono: Optional[str] = Field(default=None, max_length=15, pattern=r"^\+?[0-9\s-]+$")

    # EmailStr fuerza a que el texto tenga un @ y un dominio válido
    email: EmailStr

    puede_operar: bool = False
    puede_administrar: bool = False

# - Lo que el Frontend envía para dar de alta
class PersonaCreate(PersonaBase):
    pass

# - Lo que el Frontend envía para modificar
class PersonaUpdate(PersonaBase):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    apellido: Optional[str] = Field(default=None, max_length=40, pattern=r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$")
    dni: Optional[str] = Field(default=None, min_length=7, max_length=8, pattern=r"^\d+$")
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(default=None, max_length=15, pattern=r"^\+?[0-9\s-]+$")
    email: Optional[EmailStr] = None
    puede_operar: Optional[bool] = None
    puede_administrar: Optional[bool] = None
    activo: Optional[bool] = None  # Útil si queremos dar la baja lógica desde el frontend

# - Lo que la API le devuelve al frontend
class Persona(PersonaBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    fecha_actualizacion: Optional[datetime] = None

    # from_atributes=True permite que Pydantic trabaje con modelos SQLAlchemy
    # más info.: https://docs.pydantic.dev/latest/api/config/#pydantic.config.ConfigDict.from_attributes
    model_config = ConfigDict(from_attributes= True)

