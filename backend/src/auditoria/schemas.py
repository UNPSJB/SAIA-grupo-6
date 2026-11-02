"""Schemas de la bitácora de auditoría."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict

from src.common.paginacion import Pagina

AccionAuditoria = Literal["CREAR", "MODIFICAR", "BAJA", "REACTIVAR", "ELIMINAR"]


class CambioCampoEnriquecido(BaseModel):
    """Un campo modificado, con sus valores antes/despues y, si aplica,
    los nombres legibles de las entidades relacionadas."""

    antes: Optional[Any] = None
    despues: Optional[Any] = None
    antes_nombre: Optional[str] = None
    despues_nombre: Optional[str] = None


class DatoRegistro(BaseModel):
    """Un dato que describe al registro afectado (DNI, código, una relación...)."""

    campo: str
    valor: Optional[Any] = None
    # Si el campo es una FK: el nombre legible del objeto relacionado.
    valor_nombre: Optional[str] = None


class RegistroAuditado(BaseModel):
    """Qué registro se tocó: una etiqueta legible y sus datos identificatorios."""

    etiqueta: Optional[str] = None
    datos: List[DatoRegistro] = []


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
    # Versión enriquecida: {"campo": {"antes": ..., "despues": ...,
    # "antes_nombre": ..., "despues_nombre": ...}} con nombres legibles
    # de entidades relacionadas en vez de solo IDs.
    cambios_detalle: Optional[Dict[str, CambioCampoEnriquecido]] = None
    # El registro afectado (nombre, DNI, relaciones), también en bajas,
    # reactivaciones y modificaciones, donde el diff no lo incluye.
    registro: Optional[RegistroAuditado] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogPagina(Pagina[AuditLogItem]):
    """Página de la bitácora: la respuesta del listado de auditoría."""

    pass


class AuditLogDetalle(BaseModel):
    """Detalle completo de un evento de auditoría, con los cambios
    enriquecidos para mostrar nombres legibles en vez de solo IDs."""

    id: int
    fecha: datetime
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    entidad: str
    entidad_id: str
    accion: AccionAuditoria
    # {"campo": {"antes": ..., "despues": ..., "antes_nombre": ..., "despues_nombre": ...}}
    cambios: Optional[Dict[str, CambioCampoEnriquecido]] = None
    registro: Optional[RegistroAuditado] = None

    model_config = ConfigDict(from_attributes=True)
