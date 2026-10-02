from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.incidente import exceptions
from src.incidente.constants import TipoIncidente


class IncidenteBase(BaseModel):
    descripcion: str
    tipo: TipoIncidente
    equipo_id: Optional[int] = None
    foto_url: Optional[str] = None

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.DescripcionVacia()
        return texto


class IncidenteCreate(IncidenteBase):
    usuario_id: int


class IncidenteUpdate(BaseModel):
    descripcion: Optional[str] = None
    tipo: Optional[TipoIncidente] = None
    equipo_id: Optional[int] = None
    foto_url: Optional[str] = None
    activo: Optional[bool] = None


class IncidenteResponse(IncidenteBase):
    id: int
    usuario_id: int
    fecha_reporte: datetime
    activo: bool
    equipo_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
