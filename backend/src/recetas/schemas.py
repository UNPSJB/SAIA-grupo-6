from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.aditivos.schemas import AditivoResumen
from src.common.validators import texto_no_vacio, texto_opcional
from src.recetas import exceptions

Cantidad = Decimal


class IngredienteRecetaIn(BaseModel):
    """Renglón de la receta.

    Si es aditivo no se elige acá: sale del maestro de ingredientes y se copia
    en la versión al guardarla. Si un cliente viejo todavía manda
    `clasificacion`, se ignora.
    """

    ingrediente_id: int = Field(gt=0)
    cantidad: Cantidad = Field(gt=0, max_digits=14, decimal_places=3)
    unidad_medida_id: int = Field(gt=0)


class TareaIngredienteIn(BaseModel):
    ingrediente_id: int = Field(gt=0)
    cantidad: Cantidad = Field(gt=0, max_digits=14, decimal_places=3)


class TareaRecetaIn(BaseModel):
    descripcion: str = Field(max_length=300)
    procedimiento: str | None = Field(default=None, max_length=4000)
    ingredientes: list[TareaIngredienteIn] = Field(default_factory=list)

    @field_validator("procedimiento")
    @classmethod
    def limpiar_procedimiento(cls, valor: str | None) -> str | None:
        return (valor or "").strip() or None

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
    vida_util_dias: int | None = Field(default=None)
    ingredientes: list[IngredienteRecetaIn] = Field(min_length=1)
    tareas: list[TareaRecetaIn] = Field(min_length=1)

    @field_validator("porcion_descripcion")
    @classmethod
    def validar_porcion_descripcion(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=100)

    @field_validator("vida_util_dias")
    @classmethod
    def validar_vida_util_dias(cls, valor: int | None) -> int | None:
        if valor is not None and valor <= 0:
            raise exceptions.VidaUtilInvalida()
        return valor


class RecetaCreate(BaseModel):
    producto_id: int = Field(gt=0)
    version: VersionRecetaIn


class UnidadResumen(BaseModel):
    id: int
    nombre: str
    simbolo: str

    model_config = ConfigDict(from_attributes=True)


class IngredienteResumen(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class TareaIngredienteResponse(BaseModel):
    receta_ingrediente_id: int
    ingrediente: IngredienteResumen
    cantidad: Decimal


class TareaRecetaResponse(BaseModel):
    id: int
    orden: int
    descripcion: str
    procedimiento: str | None = None
    ingredientes: list[TareaIngredienteResponse]


class RecetaIngredienteResponse(BaseModel):
    id: int
    ingrediente: IngredienteResumen
    cantidad: Decimal
    unidad_medida: UnidadResumen
    es_aditivo: bool
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
    vida_util_dias: int | None = None
    creado_en: datetime
    creado_por_id: int | None
    creado_por_nombre: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VersionDetalle(VersionResumen):
    receta_id: int
    ingredientes: list[RecetaIngredienteResponse]
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

class IngredienteEscalado(BaseModel):
    ingrediente: IngredienteResumen
    es_aditivo: bool
    aditivo: AditivoResumen | None = None
    unidad_medida: UnidadResumen
    cantidad_receta: Decimal
    cantidad_escalada: Decimal


class TareaIngredienteEscalado(BaseModel):
    ingrediente: IngredienteResumen
    unidad_medida: UnidadResumen
    cantidad_receta: Decimal
    cantidad_escalada: Decimal


class TareaEscalada(BaseModel):
    orden: int
    descripcion: str
    ingredientes: list[TareaIngredienteEscalado]


class RecetaEscalada(BaseModel):
    receta_id: int
    producto_id: int
    producto_nombre: str
    version: VersionResumen
    factor: Decimal
    cantidad_objetivo: Decimal
    ingredientes: list[IngredienteEscalado]
    tareas: list[TareaEscalada]


# --------------------------------------------------------------------------
# Composición porcentual (E10)
# --------------------------------------------------------------------------
# Van al final porque usan `IngredienteResumen` y `UnidadResumen`: definidas antes
# de ellas, el módulo solo cargaba en Python 3.14 (anotaciones diferidas) y en
# 3.13 o anterior el backend no arrancaba (NameError).

class ComposicionItem(BaseModel):
    """Lo que representa un ingrediente de la versión: cantidad, gramos y porcentaje."""

    ingrediente: IngredienteResumen
    unidad_medida: UnidadResumen
    cantidad: Decimal
    gramos: Decimal
    porcentaje: Decimal
    aditivo: AditivoResumen | None = None
    grupo_empate: int | None = None
    orden_decidido_por: str | None = None
    orden_decidido_en: datetime | None = None

class ComposicionFaltante(BaseModel):
    """Ingrediente al que le falta una equivalencia: por eso no se puede calcular."""

    ingrediente: IngredienteResumen
    es_aditivo: bool
    motivo: str


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




class OrdenEmpateIn(BaseModel):
    """Orden elegido para un grupo de ingredientes que pesan lo mismo, del primero al último."""

    ingrediente_ids: list[int] = Field(min_length=2)