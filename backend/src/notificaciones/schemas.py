from datetime import date
from typing import Dict, Optional
from pydantic import BaseModel, Field

from src.common.paginacion import Pagina

class NotificacionResponse(BaseModel):
    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None


class ContadoresNotificaciones(BaseModel):
    """Contadores de los dropdowns de filtro del centro de notificaciones.

    `urgencia` cuenta con el filtro de origen aplicado (e ignorando el de
    urgencia); `origen` al revés. Es exactamente lo que hacía el frontend con
    la lista completa, para que los números de cada opción sigan teniendo
    sentido aunque la tabla ya solo reciba una página.
    """

    urgencia: Dict[str, int]
    origen: Dict[str, int]


class NotificacionPagina(Pagina[NotificacionResponse]):
    """Página de notificaciones + los contadores de los filtros."""

    contadores: ContadoresNotificaciones


class ConfiguracionAlertasResponse(BaseModel):
    dias_alerta_vencimiento_personal: int


class ConfiguracionAlertasUpdate(BaseModel):
    dias_alerta_vencimiento_personal: int = Field(ge=1, le=365)
