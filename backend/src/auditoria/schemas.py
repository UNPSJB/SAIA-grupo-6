"""Schemas de la bitácora de auditoría."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict

from src.common.paginacion import Pagina

AccionAuditoria = Literal["CREAR", "MODIFICAR", "BAJA", "REACTIVAR", "ELIMINAR"]


class AuditLogItem(BaseModel):
    """Un evento de la bitácora: quién cambió qué, cuándo y cómo."""

    id: int
    fecha: datetime
    # NULL = el cambio lo hizo el sistema o un script, no un usuario.
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    entidad: str
    entidad_id: str
    accion: AccionAuditoria
    # {"campo": [antes, despues]}. Las columnas sensibles llegan como "***".
    cambios: Optional[Dict[str, List[Any]]] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogPagina(Pagina[AuditLogItem]):
    """Página de la bitácora: la respuesta del listado de auditoría."""

    pass
