from pydantic import BaseModel, ConfigDict, field_validator, Field
from src.common.paginacion import Pagina
from src.common.validators import RE_NOMBRE_GENERICO, texto_obligatorio
from src.elementoLimpieza import exceptions
from datetime import date
from typing import Optional

class ElementoLimpiezaBase(BaseModel): 
    nombre: str 
    frecuencia_recambio_dias: Optional[int] = Field(default=30, ge=1) 
    
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return texto_obligatorio(
            v,
            vacio=exceptions.NombreVacio,
            invalido=exceptions.NombreInvalido,
            patron=RE_NOMBRE_GENERICO,
        )

class ElementoLimpiezaCreate(ElementoLimpiezaBase):
    fecha_ultimo_recambio: Optional[date] = Field(default_factory=date.today)


class ElementoLimpiezaUpdate(ElementoLimpiezaBase):
    nombre: str | None = None
    frecuencia_recambio_dias: int | None = Field(default=None, ge=1)
    fecha_ultimo_recambio: date | None = None
    activo: bool | None = None    

class ElementoLimpiezaOpcion(BaseModel):
    """Datos mínimos del elemento para seleccionarlo en el checklist."""

    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class ElementoLimpiezaResponse(ElementoLimpiezaBase):
  id: int
  fecha_ultimo_recambio: Optional[date] = None
  activo: bool
  #estado_alerta: str  # Propiedad calculada en el modelo: "VENCIDO", "PROXIMO_A_VENCER", "OK", etc.

  model_config = ConfigDict(from_attributes=True)


class ElementoLimpiezaPagina(Pagina[ElementoLimpiezaResponse]):
  """Página de elementos de limpieza: la respuesta del listado paginado."""

  pass
