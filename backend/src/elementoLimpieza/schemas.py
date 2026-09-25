import re
from pydantic import BaseModel, ConfigDict, field_validator, Field
from src.elementoLimpieza import exceptions
from datetime import date
from typing import Optional

class ElementoLimpiezaBase(BaseModel): 
    nombre: str 
    frecuencia_recambio_dias: Optional[int] = Field(default=30, ge=1) 
    
    @field_validator("nombre") 
    @classmethod 
    def validar_nombre(cls, v: str) -> str: 
        texto = v.strip() 
        if not texto: 
            raise exceptions.NombreVacio() 
        if not re.match(r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \\-\\.()]+$", texto) or not re.search(r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]", texto): 
            raise exceptions.NombreInvalido() 
        return texto

class ElementoLimpiezaCreate(ElementoLimpiezaBase):
    fecha_ultimo_recambio: Optional[date] = Field(default_factory=date.today)


class ElementoLimpiezaUpdate(ElementoLimpiezaBase):
    nombre: str | None = None
    frecuencia_recambio_dias: int | None = Field(default=None, ge=1)
    fecha_ultimo_recambio: date | None = None
    activo: bool | None = None    

class ElementoLimpiezaResponse(ElementoLimpiezaBase):
  id: int
  fecha_ultimo_recambio: Optional[date] = None
  activo: bool
  #estado_alerta: str  # Propiedad calculada en el modelo: "VENCIDO", "PROXIMO_A_VENCER", "OK", etc.

  model_config = ConfigDict(from_attributes=True)

