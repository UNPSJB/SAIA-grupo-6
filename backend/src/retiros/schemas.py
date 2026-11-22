from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.fechas import hoy
from src.retiros import exceptions
from src.retiros.constants import MEDIOS_CONTACTO_RETIRO, MOTIVOS_RETIRO


class RetiroCreate(BaseModel):
    """Cuerpo de `POST /retiros`."""

    lote_id: int = Field(gt=0)
    motivo: str
    detalle: Optional[str] = None
    fecha_retiro: date
    reclamo_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, v: str) -> str:
        texto = v.strip()
        if texto not in MOTIVOS_RETIRO:
            raise exceptions.RetiroMotivoInvalido()
        return texto

    @field_validator("detalle")
    @classmethod
    def validar_detalle(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return None
        texto = v.strip()
        motivo = info.data.get("motivo")
        if motivo == "Otro" and not texto:
            raise exceptions.RetiroMotivoInvalido()
        return texto or None


class RetiroCerrar(BaseModel):
    """Cuerpo de `POST /retiros/{id}/cerrar`."""

    accion_correctiva: str

    @field_validator("accion_correctiva")
    @classmethod
    def validar_accion_correctiva(cls, v: str) -> str:
        texto = v.strip()
        if not texto:
            raise exceptions.RetiroYaCerrado()
        return texto


class RetiroNotificar(BaseModel):
    """Cuerpo de `POST /retiros/{id}/afectados/{afectado_id}/notificar`."""

    fecha_notificacion: date
    medio_contacto: Optional[str] = None
    observacion: Optional[str] = None

    @field_validator("medio_contacto")
    @classmethod
    def validar_medio_contacto(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        texto = v.strip()
        if texto and texto not in MEDIOS_CONTACTO_RETIRO:
            raise exceptions.MedioContactoInvalido()
        return texto or None


class RetiroAfectadoResumen(BaseModel):
    """Fila de afectado en el listado/detalle de retiros."""

    id: int
    salida_id: int
    cliente_id: int
    cliente_nombre: str
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    cantidad_con_unidad: str
    transportista: str
    estado_salida: str
    estado_notificacion: str
    fecha_notificacion: Optional[date] = None
    medio_contacto: Optional[str] = None
    observacion: Optional[str] = None
    notificado_por: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RetiroResumen(BaseModel):
    """Fila del listado de retiros (`GET /retiros`)."""

    id: int
    lote_id: int
    lote_codigo: str
    lote_producto_nombre: str
    motivo: str
    detalle: Optional[str] = None
    origen: Optional[str] = None
    fecha_retiro: date
    estado: str
    iniciado_por_nombre: str
    total_afectados: int
    notificados: int

    model_config = ConfigDict(from_attributes=True)


class RetiroDetalle(BaseModel):
    """Detalle completo de un retiro (`GET /retiros/{id}`)."""

    id: int
    lote_id: int
    lote_codigo: str
    lote_producto_nombre: str
    lote_unidad_medida: str
    motivo: str
    detalle: Optional[str] = None
    fecha_retiro: date
    estado: str
    origen: str
    iniciado_por_nombre: str
    fecha_registro: datetime
    reclamo_id: Optional[int] = None
    incidente_id: Optional[int] = None
    incidente_estado: Optional[str] = None
    accion_correctiva: Optional[str] = None
    fecha_cierre: Optional[datetime] = None
    cerrado_por: Optional[str] = None
    saldo_en_planta: str
    en_revision: str
    afectados: list[RetiroAfectadoResumen] = []

    model_config = ConfigDict(from_attributes=True)


class SalidaAfectadaResumen(BaseModel):
    """Salida afectada para `GET /lotes/{lote_id}/impacto-retiro`."""

    salida_id: int
    cliente_id: int
    cliente_nombre: str
    cantidad_con_unidad: str
    unidad_medida: str
    transportista: str
    estado: str


class ImpactoRetiro(BaseModel):
    """Respuesta de `GET /lotes/{lote_id}/impacto-retiro`."""

    lote_id: int
    lote_codigo: str
    lote_producto_nombre: str
    reservas_a_cancelar: int
    salidas_afectadas: list[SalidaAfectadaResumen]
    total_afectadas: int
    saldo_en_planta: str
    en_revision: str

    model_config = ConfigDict(from_attributes=True)


class RetiroMasivoInsumoCreate(BaseModel):
    lote_insumo_id: int = Field(..., ge=1, description="ID del lote de insumo afectado")
    lotes_producto_ids: list[int] = Field(..., min_length=1, description="IDs de los lotes de producto a retirar")
    motivo: str = Field(..., min_length=3, max_length=100)
    detalle: str | None = Field(None, max_length=500)
    fecha_retiro: date = Field(default_factory=hoy)
    desactivar_insumo: bool = Field(True, description="Si es True, marca activo=False en el LoteInsumo")


class RetiroMasivoResultadoItem(BaseModel):
    lote_id: int
    numero_lote: str
    retiro_id: int
    clientes_afectados_count: int


class RetiroMasivoResponse(BaseModel):
    mensaje: str
    lote_insumo_id: int
    insumo_desactivado: bool
    retiros_creados: list[RetiroMasivoResultadoItem]

