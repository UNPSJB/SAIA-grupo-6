from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator
from src.common.paginacion import Pagina
from src.incidente import exceptions
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.reclamos.schemas import ReclamoResumen
from src.retiros.schemas import RetiroResumen
from src.salidas.schemas import SalidaResumen


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
            raise exceptions.TituloVacio()
        if len(texto) > 60:
            raise exceptions.TituloDemasiadoLargo()
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
    # Vínculos opcionales con el lote / la salida que originaron el incidente.
    lote_id: Optional[int] = None
    salida_id: Optional[int] = None
    # Reclamo o retiro donde se resuelve (solo en los listados de gestión).
    reclamo_id: Optional[int] = None
    retiro_id: Optional[int] = None
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


class IncidentePagina(Pagina["IncidenteResponse"]):
    """Página de incidentes: la respuesta del listado paginado en el servidor."""

    pass


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


# --------------------------------------------------------------------------
# Ficha del incidente: el registro más todo lo que lo rodea
# --------------------------------------------------------------------------


class IncidentePlanEquipo(BaseModel):
    """Plan de calibración o mantenimiento vigente del equipo involucrado."""

    tipo: str
    fecha_ultima_intervencion: date
    proximo_vencimiento: date
    dias_restantes: int


class IncidenteEquipo(BaseModel):
    id: int
    nombre: str
    tipo: str
    sector_nombre: Optional[str] = None
    activo: bool
    planes: List[IncidentePlanEquipo] = []


class IncidenteLote(BaseModel):
    id: int
    numero_lote: str
    producto_nombre: str
    unidad: str
    estado: str
    estado_lote: str
    retirado: bool
    cantidad_producida: Optional[Decimal] = None
    saldo: Decimal
    fecha_inicio: datetime
    fecha_vencimiento: Optional[date] = None


class IncidenteReposicion(BaseModel):
    """Reposición de stock al cliente que salió de este incidente."""

    id: int
    cliente_nombre: str
    producto_nombre: str
    unidad: str
    cantidad_original: Decimal
    cantidad_pendiente: Decimal
    estado: str
    prioridad: str
    fecha_registro: datetime


class IncidenteRelacionado(BaseModel):
    """Otro incidente del mismo equipo o del mismo lote."""

    id: int
    titulo: str
    tipo: TipoIncidente
    estado: EstadoIncidente
    fecha_reporte: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidenteDetalleResponse(IncidenteResponse):
    """Ficha completa (`GET /incidentes/{id}`)."""

    equipo: Optional[IncidenteEquipo] = None
    lote: Optional[IncidenteLote] = None
    salida: Optional[SalidaResumen] = None
    reclamo: Optional[ReclamoResumen] = None
    retiro: Optional[RetiroResumen] = None
    reposiciones: List[IncidenteReposicion] = []
    # Los últimos, más el total: así la ficha avisa si un equipo es reincidente.
    relacionados: List[IncidenteRelacionado] = []
    relacionados_total: int = 0
