from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio
from src.lotesInsumo import exceptions


class LoteInsumoCreate(BaseModel):
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
    motivo: str = Field(max_length=300)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.MotivoVacio)


class ProveedorResumen(BaseModel):
    id: int
    nombre: str
    matricula: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class LoteInsumoResponse(BaseModel):
    id: int
    insumo: InsumoResumen
    proveedor: ProveedorResumen
    numero_lote: str
    cantidad_recibida: Decimal
    fecha_ingreso: date
    fecha_vencimiento: date | None
    activo: bool
    motivo_baja: str | None
    fecha_baja: datetime | None

    model_config = ConfigDict(from_attributes=True)


class StockLoteInsumo(BaseModel):
    lote_insumo_id: int
    insumo_id: int
    insumo_nombre: str
    proveedor_id: int
    proveedor_nombre: str
    numero_lote: str
    fecha_vencimiento: date | None
    activo: bool
    vencido: bool
    cantidad_recibida: Decimal
    consumo_real: Decimal
    desperdicio: Decimal
    saldo: Decimal


class StockInsumo(BaseModel):
    insumo_id: int
    insumo_nombre: str
    unidad: str
    cantidad_recibida: Decimal
    consumo_real: Decimal
    desperdicio: Decimal
    stock: Decimal
    stock_vencido: Decimal
