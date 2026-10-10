from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.incidente import exceptions
from src.incidente.constants import EstadoIncidente, TipoIncidente


class IncidenteBase(BaseModel):
    titulo: str 
    descripcion: str
    tipo: TipoIncidente
    equipo_id: Optional[int] = None
    foto_url: Optional[str] = None

    @field_validator("titulo")
    @classmethod
    def validar_titulo(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.DescripcionVacia()
        return texto

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.DescripcionVacia()
        return texto


class IncidenteCreate(IncidenteBase):
    # usuario_id se asigna automáticamente desde el token JWT en el router
    # y el estado siempre arranca como "abierto".
    pass


class IncidenteEstadoUpdate(BaseModel):
    """Cierre (o reapertura) de un incidente.

    Solo el administrador lo usa. La fecha de cierre y el responsable se
    completan en el service a partir del token y del momento actual.
    """

    estado: EstadoIncidente
    observacion_cierre: Optional[str] = None

    @field_validator("observacion_cierre")
    @classmethod
    def validar_observacion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        texto = v.strip()
        return texto or None


class IncidenteResponse(IncidenteBase):
    id: int
    usuario_id: int
    fecha_reporte: datetime
    estado: EstadoIncidente
    fecha_cierre: Optional[datetime] = None
    observacion_cierre: Optional[str] = None
    responsable_cierre_id: Optional[int] = None
    equipo_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None
    responsable_cierre_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class IncidenteResumenTipo(BaseModel):
    """Cantidad de incidentes de un tipo (para el tablero E7)."""

    tipo: TipoIncidente
    cantidad: int


class IncidenteResumenResponse(BaseModel):
    """Resumen de incidentes por tipo.

    Los cinco tipos aparecen siempre, con cantidad 0 si no hay registros:
    así el indicador del tablero puede graficar tipos vacíos. `estado`
    indica sobre qué universo se contó ("abierto" por defecto).
    """

    estado: str
    total: int
    por_tipo: List[IncidenteResumenTipo]


class HistorialIncidenteItem(BaseModel):
    """Un evento del historial de un incidente."""

    id: int
    estado_anterior: str
    estado_nuevo: str
    usuario_id: int
    usuario_nombre: Optional[str] = None
    observacion: Optional[str] = None
    fecha_evento: datetime

    model_config = ConfigDict(from_attributes=True)


class HistorialIncidenteResponse(BaseModel):
    """Historial completo de un incidente."""

    incidente_id: int
    eventos: List[HistorialIncidenteItem]