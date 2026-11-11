from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.aditivos.schemas import AditivoResumen
from src.common.validators import texto_no_vacio, texto_opcional
from src.recetas import exceptions

Cantidad = Decimal
# esto para poder mandar al fronter cuanto representa cada item 
class ComposicionItem(BaseModel):
    insumo: InsumoResumen
    unidad_medida: UnidadResumen
    cantidad: Decimal
    gramos: Decimal
    porcentaje: Decimal

# esto para decir porque no se puede hacer las coasa hora 
class ComposicionFaltante(BaseModel):
    insumo: InsumoResumen
    clasificacion: str
    motivo: str

# la respuesta completa
class Composicion(BaseModel):
    version_id: int
    version_numero: int
    receta_id: int
    producto_nombre: str
    completa: bool
    total_gramos: Decimal | None = None
    ingredientes: list[ComposicionItem] = Field(default_factory=list)
    aditivos: list[ComposicionItem] = Field(default_factory=list)
    suma_porcentajes: Decimal | None = None
    suma_correcta: bool | None = None
    faltantes: list[ComposicionFaltante] = Field(default_factory=list)

class InsumoRecetaIn(BaseModel):
    """Renglón de la receta.

    La clasificación (ingrediente o aditivo) ya no se elige acá: sale del
    maestro de insumos y se copia en la versión al guardarla. Si un cliente
    viejo todavía manda `clasificacion`, se ignora.
    """

    insumo_id: int = Field(gt=0)
    cantidad: Cantidad = Field(gt=0, max_digits=14, decimal_places=3)
    unidad_medida_id: int = Field(gt=0)


class TareaInsumoIn(BaseModel):
    insumo_id: int = Field(gt=0)
    cantidad: Cantidad = Field(gt=0, max_digits=14, decimal_places=3)


class TareaRecetaIn(BaseModel):
    descripcion: str = Field(max_length=300)
    insumos: list[TareaInsumoIn] = Field(default_factory=list)

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, valor: str) -> str:
        return texto_no_vacio(valor, vacio=exceptions.DescripcionVacia)


class VersionRecetaIn(BaseModel):
    rendimiento: Cantidad = Field(gt=0, max_digits=14, decimal_places=3)
    unidad_medida_id: int = Field(gt=0)
    # Porción o unidad de venta: opcional, pero si hay cantidad hay unidad.
    porcion_descripcion: str | None = Field(default=None, max_length=100)
    porcion_cantidad: Cantidad | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    porcion_unidad_medida_id: int | None = Field(default=None, gt=0)
    insumos: list[InsumoRecetaIn] = Field(min_length=1)
    tareas: list[TareaRecetaIn] = Field(min_length=1)

    @field_validator("porcion_descripcion")
    @classmethod
    def validar_porcion_descripcion(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=100)


class RecetaCreate(BaseModel):
    producto_id: int = Field(gt=0)
    version: VersionRecetaIn


class UnidadResumen(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)


class InsumoResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class TareaInsumoResponse(BaseModel):
    receta_insumo_id: int
    insumo: InsumoResumen
    cantidad: Decimal


class TareaRecetaResponse(BaseModel):
    id: int
    orden: int
    descripcion: str
    insumos: list[TareaInsumoResponse]


class RecetaInsumoResponse(BaseModel):
    id: int
    insumo: InsumoResumen
    cantidad: Decimal
    unidad_medida: UnidadResumen
    clasificacion: str
    # Clase funcional, nombre completo e INS, del maestro (solo aditivos).
    aditivo: AditivoResumen | None = None


class VersionResumen(BaseModel):
    id: int
    numero: int
    rendimiento: Decimal
    unidad_medida: UnidadResumen
    porcion_descripcion: str | None = None
    porcion_cantidad: Decimal | None = None
    porcion_unidad_medida: UnidadResumen | None = None
    creado_en: datetime
    creado_por_id: int | None

    model_config = ConfigDict(from_attributes=True)


class VersionDetalle(VersionResumen):
    receta_id: int
    insumos: list[RecetaInsumoResponse]
    tareas: list[TareaRecetaResponse]


class RecetaResponse(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    activo: bool
    version_vigente: VersionResumen | None


# --------------------------------------------------------------------------
# Escalado (vista de cálculo: no modifica la receta)
# --------------------------------------------------------------------------

class InsumoEscalado(BaseModel):
    insumo: InsumoResumen
    clasificacion: str
    aditivo: AditivoResumen | None = None
    unidad_medida: UnidadResumen
    cantidad_receta: Decimal
    cantidad_escalada: Decimal


class TareaInsumoEscalado(BaseModel):
    insumo: InsumoResumen
    unidad_medida: UnidadResumen
    cantidad_receta: Decimal
    cantidad_escalada: Decimal


class TareaEscalada(BaseModel):
    orden: int
    descripcion: str
    insumos: list[TareaInsumoEscalado]


class RecetaEscalada(BaseModel):
    receta_id: int
    producto_id: int
    producto_nombre: str
    version: VersionResumen
    factor: Decimal
    cantidad_objetivo: Decimal
    insumos: list[InsumoEscalado]
    tareas: list[TareaEscalada]
