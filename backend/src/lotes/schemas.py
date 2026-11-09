from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_no_vacio, texto_opcional
from src.lotes import exceptions


class LoteCreate(BaseModel):
    """Se indica la cantidad objetivo de producto terminado o un factor
    multiplicador de la receta (E9: duplicarla = factor 2). Uno de los dos."""

    producto_id: int = Field(gt=0)
    cantidad_objetivo: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    factor: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=6)


class LoteCierre(BaseModel):
    cantidad_producida: Decimal = Field(gt=0, max_digits=14, decimal_places=3)


class LoteCancelacion(BaseModel):
    motivo: str = Field(max_length=300)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.MotivoVacio)


class ConsumoCreate(BaseModel):
    lote_insumo_id: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    tipo: Literal["real", "desperdicio"] = "real"
    motivo: str | None = Field(default=None, max_length=300)

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=300)


class ConsumoResponse(BaseModel):
    id: int
    checklist_produccion_id: int
    lote_insumo_id: int
    insumo_id: int
    insumo_nombre: str
    numero_lote_insumo: str
    proveedor_nombre: str
    cantidad: Decimal
    tipo: str
    motivo: str | None
    registrado_por_id: int | None
    registrado_por_nombre: str | None = None
    registrado_en: datetime
    advertencias: list[str] = Field(default_factory=list)


class InsumoPlanificado(BaseModel):
    insumo_id: int
    insumo_nombre: str
    unidad: str
    cantidad_planificada: Decimal
    consumo_real: Decimal
    desperdicio: Decimal


class ItemChecklist(BaseModel):
    id: int
    tarea_receta_id: int
    orden: int
    descripcion: str
    completado: bool
    completado_por_id: int | None
    completado_por_nombre: str | None = None
    completado_en: datetime | None
    insumos: list[InsumoPlanificado]
    consumos: list[ConsumoResponse]


class LoteResumen(BaseModel):
    id: int
    numero_lote: str
    producto_id: int
    producto_nombre: str
    unidad: str
    version_receta_id: int | None
    version_numero: int | None
    estado: str
    cantidad_objetivo: Decimal
    factor_escala: Decimal | None
    cantidad_producida: Decimal | None
    motivo_cancelacion: str | None
    creado_por_id: int | None
    creado_por_nombre: str | None = None
    fecha_inicio: datetime
    fecha_cierre: datetime | None
    items_total: int
    items_completados: int

    model_config = ConfigDict(from_attributes=True)


class LoteDetalle(LoteResumen):
    checklist: list[ItemChecklist]


class LoteResumenEstado(BaseModel):
    estado: str
    cantidad: int


class ProduccionPorProducto(BaseModel):
    producto: str
    cantidad_producida: Decimal
    cantidad_lotes: int
    # Símbolo de la unidad del producto ("Kg", "un"): sin ella el gráfico
    # mostraba "210,066" sin decir de qué.
    unidad: str


class TotalPorUnidad(BaseModel):
    unidad: str
    cantidad: Decimal


class DashboardLotesResponse(BaseModel):
    total_lotes: int
    # Suma de todos los productos sin importar su unidad (kilos + unidades):
    # se mantiene por compatibilidad, pero no tiene sentido mostrarla.
    # Usar `total_por_unidad`.
    total_cantidad_producida: Decimal
    total_por_unidad: list[TotalPorUnidad]
    por_estado: list[LoteResumenEstado]
    por_producto: list[ProduccionPorProducto]
