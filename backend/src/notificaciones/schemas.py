from datetime import date
from typing import Optional
from pydantic import BaseModel
from pydantic import BaseModel, Field

class NotificacionResponse(BaseModel):
    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None


class ConfiguracionAlertasResponse(BaseModel):
    dias_alerta_vencimiento_personal: int


class ConfiguracionAlertasUpdate(BaseModel):
    dias_alerta_vencimiento_personal: int = Field(ge=1, le=365)