from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ClienteBasico(BaseModel):
    """Datos mínimos de un cliente para elegir en el alta de un reclamo."""

    id: int
    nombre: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class ReclamoResumen(BaseModel):
    """Fila del listado de reclamos."""

    id: int
    salida_id: int
    cliente_id: int
    cliente_nombre: str
    lote_id: int
    lote_numero: str
    producto_nombre: str
    fecha_entrega: date
    fecha_reclamo: date
    motivo: str
    motivo_label: str
    detalle: Optional[str] = None
    dias_desde_entrega: int
    plazo_referencia_dias: int
    fuera_de_plazo: bool
    incidente_id: Optional[int] = None
    incidente_estado: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReclamoSalidaDetalle(BaseModel):
    """Datos de la salida asociada, para la ficha del reclamo."""

    id: int
    fecha_entrega: date
    fecha_despacho: Optional[date] = None
    cantidad: str
    unidad_medida: str
    producto_nombre: str
    lote_numero: str


class ReclamoIncidenteDetalle(BaseModel):
    id: int
    estado: str
    foto_url: Optional[str] = None
    fecha_cierre: Optional[str] = None
    observacion_cierre: Optional[str] = None
    responsable_cierre_nombre: Optional[str] = None


class ReclamoDetalle(ReclamoResumen):
    """Ficha completa del reclamo."""

    registrado_por_nombre: Optional[str] = None
    fecha_registro: Optional[str] = None
    salida: ReclamoSalidaDetalle
    incidente: Optional[ReclamoIncidenteDetalle] = None
