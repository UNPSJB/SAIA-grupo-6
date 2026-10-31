import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.paginacion import Pagina
from src.insumoQuimico.models import TipoMovimientoStock, TipoQuimico
from src.insumoQuimico import exceptions


class InsumoQuimicoBase(BaseModel):
    nombre: str
    tipo: TipoQuimico
    unidad_medida_id: int

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        texto = v.strip()

        if not texto:
            raise exceptions.NombreVacio()

        patron = r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$"

        if (
            not re.match(patron, texto)
            or not re.search(
                r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]",
                texto
            )
        ):
            raise exceptions.NombreInvalido()

        return texto


class InsumoQuimicoCreate(InsumoQuimicoBase):
    pass


class InsumoQuimicoUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[TipoQuimico] = None
    unidad_medida_id: Optional[int] = None
    activo: Optional[bool] = None

    # Mismas validaciones que el alta: sin esto se podían guardar nombres
    # vacíos o inválidos que después rompían la serialización de la respuesta.
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None

        texto = v.strip()

        if not texto:
            raise exceptions.NombreVacio()

        patron = r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$"

        if (
            not re.match(patron, texto)
            or not re.search(
                r"[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]",
                texto
            )
        ):
            raise exceptions.NombreInvalido()

        return texto


class InsumoQuimicoResponse(InsumoQuimicoBase):
    id: int
    activo: bool
    unidad_medida: "UnidadMedidaResponse"

    model_config = ConfigDict(from_attributes=True)


class InsumoQuimicoOpcion(BaseModel):
    """Datos mínimos del producto para seleccionarlo en el checklist."""

    id: int
    nombre: str
    unidad_simbolo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UnidadMedidaResponse(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)


class StockInsumoQuimicoResponse(BaseModel):
    insumo_quimico_id: int
    nombre: str
    unidad_medida_id: int
    unidad_simbolo: Optional[str] = None
    activo: bool
    cantidad_actual: Decimal
    stock_minimo: Optional[Decimal] = None
    stock_bajo: bool


class StockMinimoUpdate(BaseModel):
    stock_minimo: Optional[Decimal] = Field(default=None, ge=0, max_digits=14, decimal_places=3)


class IngresoStockCreate(BaseModel):
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    proveedor_id: int = Field(gt=0)
    numero_lote: str = Field(max_length=100)

    @field_validator("numero_lote")
    @classmethod
    def validar_numero_lote(cls, valor: str) -> str:
        texto = valor.strip()
        if not texto:
            raise exceptions.NumeroLoteRequerido()
        return texto


class AjusteStockCreate(BaseModel):
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    operacion: Literal["incremento", "decremento"]
    motivo: str = Field(max_length=500)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str) -> str:
        texto = valor.strip()
        if not texto:
            raise exceptions.MotivoAjusteRequerido()
        return texto


class MovimientoStockResponse(BaseModel):
    id: int
    fecha: datetime
    tipo: TipoMovimientoStock
    cantidad_variacion: Decimal
    nombre_producto: str
    unidad_simbolo: Optional[str] = None
    responsable_nombre: Optional[str] = None
    motivo: Optional[str] = None
    checklist_id: Optional[int] = None
    registro_tarea_id: Optional[int] = None
    tarea_nombre: Optional[str] = None
    checklist_fecha: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class MovimientosStockResponse(BaseModel):
    items: list[MovimientoStockResponse]
    total: int
    limit: int
    offset: int


class LoteStockResponse(BaseModel):
    id: int
    proveedor_id: int
    proveedor_nombre: str
    insumo_quimico_id: int
    nombre_producto: str
    unidad_simbolo: Optional[str] = None
    numero_lote: str
    cantidad_producto: Decimal
    fecha_ingreso: datetime
    movimiento_ingreso_id: int


class LotesStockResponse(BaseModel):
    items: list[LoteStockResponse]
    total: int
    limit: int
    offset: int


class InsumoQuimicoPagina(Pagina["InsumoQuimicoResponse"]):
    """Página de insumos químicos: la respuesta del listado paginado."""

    pass


class StockInsumoQuimicoPagina(Pagina[StockInsumoQuimicoResponse]):
    """Página del saldo actual de productos químicos activos."""

    pass
