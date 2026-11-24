from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class ReclamoRetiroDetalle(BaseModel):
    """Retiro del lote del reclamo (un lote admite un solo retiro)."""

    id: int
    estado: str


class ReclamoReposicionDetalle(BaseModel):
    """Reposición que ya generó el reclamo (admite una sola)."""

    id: int
    estado: str
    cantidad_original: Decimal
    cantidad_pendiente: Decimal

    model_config = ConfigDict(from_attributes=True)


class ReclamoDetalle(ReclamoResumen):
    """Ficha completa del reclamo."""

    registrado_por_nombre: Optional[str] = None
    fecha_registro: Optional[str] = None
    salida: ReclamoSalidaDetalle
    incidente: Optional[ReclamoIncidenteDetalle] = None
    retiro: Optional[ReclamoRetiroDetalle] = None
    reposicion: Optional[ReclamoReposicionDetalle] = None


class ReclamoCerrar(BaseModel):
    """Cierre del reclamo: qué se hizo, con la mercadería y con el cliente."""

    accion_correctiva: str
    mercaderia_devuelta: bool = False
    disposicion_fisica: Optional[Literal["CUARENTENA", "BAJA"]] = None
    generar_reposicion: bool = False
    cantidad_a_reponer: Optional[Decimal] = Field(None, gt=0)

    @model_validator(mode="after")
    def validar_resolucion(self):
        if self.mercaderia_devuelta and self.disposicion_fisica is None:
            raise ValueError("Indicá el destino de la mercadería devuelta.")
        if self.generar_reposicion and self.cantidad_a_reponer is None:
            raise ValueError("Indicá la cantidad a reponer.")
        return self


class ReclamoReabrir(BaseModel):
    motivo: Optional[str] = None
