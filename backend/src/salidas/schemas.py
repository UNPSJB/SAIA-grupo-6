from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio, texto_opcional
from src.salidas import exceptions


class SalidaCreate(BaseModel):
    lote_id: int = Field(gt=0)
    cliente_id: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    fecha_reserva: date

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, valor: Decimal) -> Decimal:
        if valor <= 0:
            raise exceptions.CantidadInvalida()
        return valor


class SalidaCertificacionResumen(BaseModel):
    id: int
    tipo: str
    numero: str
    fecha_vencimiento: date
    activa: bool

    model_config = ConfigDict(from_attributes=True)


class SalidaReclamoResumen(BaseModel):
    """Reclamo de cliente asociado a una entrega (para la ficha de la salida)."""

    id: int
    fecha_reclamo: date
    motivo: str
    motivo_label: str | None = None
    incidente_estado: str | None = None
    fuera_de_plazo: bool = False


class SalidaResumen(BaseModel):
    id: int
    lote_id: int
    lote_numero: str
    producto_nombre: str
    unidad_medida: str
    cliente_id: int
    cliente_nombre: str
    cliente_contacto: str | None = None
    cliente_domicilio: str | None = None
    cantidad: Decimal
    fecha_reserva: date
    fecha_vencimiento: date | None = None
    # Fecha de elaboración real del lote de origen (lote.fecha_inicio).
    fecha_elaboracion: date | None = None
    estado: str
    creado_por_id: int | None = None
    creado_por_nombre: str | None = None
    creado_en: Optional[str] = None
    # Campos de despacho / entrega / cancelación.
    forma_entrega: str | None = None
    transportista_id: int | None = None
    transportista_nombre: str | None = None
    fecha_despacho: date | None = None
    fecha_entrega: date | None = None
    # Momento exacto en que se confirmó el despacho / la entrega.
    despachado_en: Optional[str] = None
    entregado_en: Optional[str] = None
    observacion_entrega: str | None = None
    motivo_cancelacion: str | None = None
    cancelada_por_nombre: str | None = None
    fecha_cancelacion: Optional[str] = None
    # Quién recibió la entrega (si corresponde).
    recibido_por: str | None = None
    # Rechazo de la entrega y disposición posterior.
    motivo_rechazo: str | None = None
    motivo_rechazo_label: str | None = None
    detalle_rechazo: str | None = None
    fecha_rechazo: date | None = None
    rechazada_por_nombre: str | None = None
    disposicion: str | None = None
    justificacion_disposicion: str | None = None
    fecha_disposicion: Optional[str] = None
    decidida_por_nombre: str | None = None
    incidente_id: int | None = None
    incidente_estado: str | None = None
    incidente_foto_url: str | None = None
    # Indica si el lote de origen está retirado: el frontend lo usa para
    # deshabilitar el reingreso al resolver un rechazo.
    lote_retirado: bool = False
    # Retiro asociado al lote (si existe).
    retiro_id: int | None = None
    retiro_estado: str | None = None
    # Certificaciones del transportista vigentes al despachar.
    certificaciones: list[SalidaCertificacionResumen] = []
    # Reclamos de cliente registrados sobre esta entrega.
    reclamos: list[SalidaReclamoResumen] = []

    model_config = ConfigDict(from_attributes=True)


class SalidaDespachar(BaseModel):
    forma_entrega: str
    transportista_id: int | None = None
    fecha_despacho: date


class SalidaEntregar(BaseModel):
    fecha_entrega: date
    observacion: str | None = None
    recibido_por: str | None = None
    forma_entrega: str | None = None


class SalidaCancelar(BaseModel):
    motivo: str

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.MotivoRequerido)


class SalidaResolverRechazo(BaseModel):
    """Resolución de un rechazo: reingresar la mercadería o desecharla."""

    disposicion: str
    justificacion: str

    @field_validator("justificacion")
    @classmethod
    def validar_justificacion(cls, valor: str | None) -> str | None:
        return texto_no_vacio(valor, vacio=exceptions.JustificacionRequerida)


class HitoLoteResumen(BaseModel):
    id: int
    lote_id: int
    salida_id: int | None
    fecha_hora: str
    tipo_evento: str
    descripcion: str
    usuario_id: int
    usuario_nombre: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ClienteDisponible(BaseModel):
    """Cliente activo para elegir al reservar una salida (puede_operar)."""

    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class LoteDisponible(BaseModel):
    """Lote con saldo disponible para reservar (puede_operar)."""

    id: int
    codigo: str
    producto_nombre: str
    unidad_medida: str
    saldo: Decimal
    fecha_inicio: date | None
    fecha_vencimiento: date | None

    model_config = ConfigDict(from_attributes=True)
