from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.rotulado.declaraciones_schemas import DeclaracionesOut
from src.rotulado_frontal.schemas import SellosRotulado


class CampoCompletitud(BaseModel):
    nombre: str
    etiqueta: str
    estado: str
    motivo: Optional[str] = None


class CompletitudRotulado(BaseModel):
    borrador_id: int
    estado_global: str
    campos: list[CampoCompletitud]


class CampoEditadoOut(BaseModel):
    id: int
    campo: str
    valor_original: Optional[str]
    valor_nuevo: Optional[str]
    origen: str
    tipo_operacion: str
    usuario_id: Optional[int]
    usuario_nombre: Optional[str]
    modificado_en: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class BorradorRotuladoBase(BaseModel):
    denominacion_venta: Optional[str] = Field(default=None, max_length=200)
    lista_ingredientes: Optional[str] = None
    contenido_neto: Optional[str] = Field(default=None, max_length=100)
    rnpa_rppa: Optional[str] = Field(default=None, max_length=50)
    razon_social: Optional[str] = Field(default=None, max_length=200)
    domicilio: Optional[str] = Field(default=None, max_length=300)
    identificacion_lote: Optional[str] = Field(default=None, max_length=100)
    fecha_produccion: Optional[date] = None
    fecha_cierre: Optional[date] = None
    fecha_duracion: Optional[date] = None
    instrucciones_uso: Optional[str] = None
    es_importado: bool = False
    importador_razon_social: Optional[str] = Field(default=None, max_length=200)
    importador_domicilio: Optional[str] = Field(default=None, max_length=300)
    estado: Optional[str] = Field(default="borrador", max_length=20)
    datos_nutricionales_json: Optional[str] = None
    sellos_disponibles: bool = False


class BorradorRotuladoCreate(BorradorRotuladoBase):
    producto_id: int = Field(gt=0)
    version_receta_id: Optional[int] = Field(default=None, gt=0)
    lote_producto_id: Optional[int] = Field(default=None, gt=0)


class BorradorRotuladoUpdate(BaseModel):
    version_receta_id: Optional[int] = Field(default=None, gt=0)
    lote_producto_id: Optional[int] = Field(default=None, gt=0)
    denominacion_venta: Optional[str] = Field(default=None, max_length=200)
    lista_ingredientes: Optional[str] = None
    contenido_neto: Optional[str] = Field(default=None, max_length=100)
    rnpa_rppa: Optional[str] = Field(default=None, max_length=50)
    razon_social: Optional[str] = Field(default=None, max_length=200)
    domicilio: Optional[str] = Field(default=None, max_length=300)
    identificacion_lote: Optional[str] = Field(default=None, max_length=100)
    fecha_produccion: Optional[date] = None
    fecha_cierre: Optional[date] = None
    fecha_duracion: Optional[date] = None
    instrucciones_uso: Optional[str] = None
    es_importado: Optional[bool] = None
    importador_razon_social: Optional[str] = Field(default=None, max_length=200)
    importador_domicilio: Optional[str] = Field(default=None, max_length=200)
    estado: Optional[str] = Field(default=None, max_length=20)
    datos_nutricionales_json: Optional[str] = None
    sellos_disponibles: Optional[bool] = None


class BorradorRotuladoOut(BorradorRotuladoBase):
    id: int
    producto_id: int
    version_receta_id: Optional[int]
    lote_producto_id: Optional[int]
    version_receta_numero: Optional[int] = None
    lote_numero: Optional[str] = None
    producto_nombre: Optional[str] = None
    creado_en: Optional[datetime]
    actualizado_en: Optional[datetime]
    creado_por_id: Optional[int]
    actualizado_por_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class ProductoConBorrador(BaseModel):
    producto_id: int
    producto_nombre: str
    unidad_simbolo: Optional[str]
    borrador_id: Optional[int]
    borrador_estado: Optional[str]
    borrador_actualizado_en: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class AutocompletarIn(BaseModel):
    version_id: Optional[int] = Field(default=None, gt=0)
    lote_id: Optional[int] = Field(default=None, gt=0)
    forzar: bool = False


class VistaPreviaAutocompletado(BaseModel):
    """Vista previa de datos autocompletados para un producto, sin guardar.

    Se usa para poblar el formulario de creación de borrador sin
    persistir nada en la base de datos hasta que el usuario guarde.
    """

    producto_id: int
    producto_nombre: str
    denominacion_venta: Optional[str] = None
    lista_ingredientes: Optional[str] = None
    datos_nutricionales_json: Optional[str] = None
    sellos_disponibles: bool = False
    version_receta_id: Optional[int] = None
    version_receta_numero: Optional[int] = None
    # Del establecimiento activo (razón social y dirección).
    razon_social: Optional[str] = None
    domicilio: Optional[str] = None
    declaraciones: dict | None = None
    receta_encontrada: bool = False
    mensaje: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrigenPrevisualizacion(BaseModel):
    estado: Literal["verificado", "sin_version", "incompatible"]
    version_id: int | None = None
    version_numero: int | None = None
    lote_id: int | None = None
    motivo: str | None = None


class FilaInstantaneaNutricional(BaseModel):
    clave: str
    nombre: str
    unidad: str
    por_100: Decimal | None = None
    por_porcion: Decimal | None = None
    vd: Decimal | None = None
    por_100_texto: str | None = None
    por_porcion_texto: str | None = None
    vd_texto: str | None = None
    faltan_datos: bool = False
    no_significativo: bool = False
    de_laboratorio: bool = False


class InstantaneaNutricional(BaseModel):
    version_id: int | None = None
    estado: str | None = None
    problemas: list[str] = Field(default_factory=list)
    expresar_en: Literal["g", "ml"] | None = None
    porcion: Decimal | None = None
    medida_casera: str | None = None
    filas: list[FilaInstantaneaNutricional] = Field(default_factory=list)
    calculado_en: datetime | None = None
    # Presentación (formato del rótulo); faltan en las instantáneas viejas.
    mostrar_por_100: bool | None = None
    leyenda_no_significativo: str | None = None
    leyenda_vd: str | None = None
    leyenda_laboratorio: str | None = None


class NutricionPrevisualizacion(BaseModel):
    estado: Literal["completa", "incompleta", "ausente", "ilegible", "origen_no_verificable", "version_distinta"]
    problemas: list[str] = Field(default_factory=list)
    version_id: int | None = None
    tabla: InstantaneaNutricional | None = None
    difiere_de_e12: bool = False


class FrontalPrevisualizacion(BaseModel):
    estado: str
    mensaje: str
    faltantes: list[str] = Field(default_factory=list)
    advertencias: list[str] = Field(default_factory=list)
    version_id: int | None = None
    evaluado_en: datetime | None = None
    regla_version: int | None = None
    sellos: SellosRotulado | None = None


class PrevisualizacionRotulado(BaseModel):
    borrador: BorradorRotuladoOut
    origen: OrigenPrevisualizacion
    completitud: CompletitudRotulado
    nutricion: NutricionPrevisualizacion
    declaraciones: DeclaracionesOut | None
    rotulado_frontal: FrontalPrevisualizacion
