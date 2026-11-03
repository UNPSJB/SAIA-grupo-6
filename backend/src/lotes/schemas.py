from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductoResponse(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class LoteCreate(BaseModel):
    """Alta de un lote de producción.

    El producto se toma del maestro de insumos de E1 (`Insumo` con
    `tipo="producto"`), por id o por nombre. Si se envía un nombre nuevo, se
    crea en ese mismo maestro. Se mantiene compatibilidad con el formato
    anterior que usaba `cantidad_planificada`.
    """

    codigo_lote: str | None = Field(default=None, max_length=50)
    producto_id: int | None = Field(default=None, gt=0)
    producto_nombre: str | None = Field(default=None, max_length=120)
    cantidad_planificada: int | None = Field(default=None, gt=0)
    cantidad_producida: int | None = Field(default=None, gt=0)
    fecha_inicio: datetime | None = None

    @field_validator("codigo_lote")
    @classmethod
    def validar_codigo_lote(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        texto = valor.strip()
        if not texto:
            raise ValueError("El código de lote no puede estar vacío.")
        return texto

    @field_validator("producto_nombre")
    @classmethod
    def validar_producto_nombre(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        texto = valor.strip()
        if not texto:
            raise ValueError("El nombre del producto no puede estar vacío.")
        return texto

    @model_validator(mode="after")
    def validar_campos_requeridos(self):
        if self.producto_id is None and self.producto_nombre is None:
            raise ValueError("Indicá un producto o el nombre de un producto nuevo.")
        if self.cantidad_planificada is None and self.cantidad_producida is None:
            raise ValueError("Indicá la cantidad producida.")
        if self.cantidad_planificada is None:
            self.cantidad_planificada = self.cantidad_producida
        return self


class InsumoLoteCreate(BaseModel):
    insumo_id: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)


class InsumosLoteCreate(BaseModel):
    insumos: list[InsumoLoteCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validar_insumos_unicos(self):
        ids = [insumo.insumo_id for insumo in self.insumos]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un insumo en la misma asociación.")
        return self


class UnidadMedidaResumen(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResumen(BaseModel):
    id: int
    nombre: str
    unidad_medida: UnidadMedidaResumen

    model_config = ConfigDict(from_attributes=True)


class InsumoLoteResponse(BaseModel):
    id: int
    lote_id: int
    insumo_id: int
    cantidad: Decimal
    fecha_registro: datetime
    insumo: InsumoResumen

    model_config = ConfigDict(from_attributes=True)


class LoteResponse(BaseModel):
    id: int
    codigo_lote: str
    producto_id: int | None = None
    producto_nombre: str
    cantidad_planificada: int
    cantidad_producida: int
    estado: str
    fecha_inicio: datetime
    insumos: list[InsumoLoteResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LoteResumenEstado(BaseModel):
    estado: str
    cantidad: int


class ProduccionPorProducto(BaseModel):
    producto: str
    cantidad_producida: int
    cantidad_lotes: int


class DashboardLotesResponse(BaseModel):
    total_lotes: int
    total_cantidad_planificada: int
    total_cantidad_producida: int
    porcentaje_cumplimiento: float
    por_estado: list[LoteResumenEstado]
    por_producto: list[ProduccionPorProducto]
