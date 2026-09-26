from datetime import date
from typing import Optional
from pydantic import BaseModel

class NotificacionResponse(BaseModel):
    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None