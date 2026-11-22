from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio, texto_opcional
from src.lotesInsumo import exceptions

MotivoBajaTipo = Literal["danado", "vencido", "contaminado", "devuelto_proveedor"]


class LoteInsumoCreate(BaseModel):
    # El insumo (marca) recibido; el ingrediente sale de él.
    insumo_id: int = Field(gt=0)
    proveedor_id: int = Field(gt=0)
    numero_lote: str = Field(max_length=100)
    cantidad_recibida: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    fecha_ingreso: date | None = None
    fecha_vencimiento: date | None = None

    @field_validator("numero_lote")
    @classmethod
    def validar_numero(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.NumeroVacio)


class LoteInsumoBaja(BaseModel):
    motivo: MotivoBajaTipo
    cantidad: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    observaciones: str | None = Field(default=None, max_length=300)
    foto_data_url: str | None = Field(default=None, max_length=2_500_000)
    dar_de_baja_lote_completo: bool = False

    @field_validator("observaciones")
    @classmethod
    def validar_observaciones(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=300)


class BajaLoteInsumoResponse(BaseModel):
    id: int
    lote_insumo_id: int
    motivo: str
    motivo_etiqueta: str
    observaciones: str | None
    cantidad: Decimal
    tiene_foto: bool
    foto_data_url: str | None
    registrado_por_id: int
    registrado_por_nombre: str
    registrado_en: datetime


class ProveedorResumen(BaseModel):
    id: int
    nombre: str
    matricula: str

    model_config = ConfigDict(from_attributes=True)


class IngredienteResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResumen(BaseModel):
    id: int
    marca: str
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class LoteInsumoResponse(BaseModel):
    id: int
    insumo: InsumoResumen
    ingrediente: IngredienteResumen
    proveedor: ProveedorResumen
    numero_lote: str
    cantidad_recibida: Decimal
    fecha_ingreso: date
    fecha_vencimiento: date | None
    activo: bool
    motivo_baja: str | None
    fecha_baja: datetime | None
    dado_de_baja_por_nombre: str | None = None
    certificacion_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class StockLoteInsumo(BaseModel):
    lote_insumo_id: int
    insumo_id: int
    # Marca (y descripción, si hay) del insumo recibido.
    insumo_nombre: str
    ingrediente_id: int
    ingrediente_nombre: str
    unidad: str
    proveedor_id: int
    proveedor_nombre: str
    numero_lote: str
    fecha_vencimiento: date | None
    activo: bool
    vencido: bool
    # Por qué la marca no se puede consumir (homologación no aprobada o
    # vencida); None si se puede.
    marca_no_utilizable: str | None = None
    motivo_baja: str | None = None
    fecha_baja: datetime | None = None
    dado_de_baja_por_nombre: str | None = None
    cantidad_recibida: Decimal
    consumo_real: Decimal
    desperdicio: Decimal
    cantidad_baja: Decimal
    saldo: Decimal


class StockIngrediente(BaseModel):
    ingrediente_id: int
    ingrediente_nombre: str
    unidad: str
    cantidad_recibida: Decimal
    consumo_real: Decimal
    desperdicio: Decimal
    cantidad_baja: Decimal
    stock: Decimal
    stock_vencido: Decimal


class IndicadorBajasPorMotivoItem(BaseModel):
    motivo: str
    etiqueta: str
    cantidad_registros: int
    cantidad_total: Decimal


class IndicadorBajasResponse(BaseModel):
    total_registros: int
    por_motivo: list[IndicadorBajasPorMotivoItem]