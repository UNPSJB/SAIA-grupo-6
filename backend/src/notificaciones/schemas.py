from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field

Criticidad = Literal["alta", "media", "baja"]
NivelGeneralCriticidad = Literal["alto", "medio", "bajo"]

IconoCriticidad = Literal[
    "limpieza",
    "calibracion",
    "incidente",
    "personal",
    "documento",
    "checklist",
]


class NotificacionResponse(BaseModel):
    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None

    grupo_clave: Optional[str] = None


class AlertaCriticidadResponse(BaseModel):
    clave: str
    origen: str
    entidad_id: int
    grupo_clave: str
    icono: IconoCriticidad
    titulo: str
    detalle: str
    criticidad: Criticidad
    motivo: str
    plazo: str
    destino: str
    recambio_id: Optional[int] = None


class CriticidadDashboardResponse(BaseModel):
    nivel_general: NivelGeneralCriticidad
    total: int
    altas: int
    medias: int
    bajas: int
    alertas: list[AlertaCriticidadResponse]


class ConfiguracionAlertasResponse(BaseModel):
    dias_alerta_vencimiento_personal: int


class ConfiguracionAlertasUpdate(BaseModel):
    dias_alerta_vencimiento_personal: int = Field(ge=1, le=365)