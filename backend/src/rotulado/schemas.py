from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
    declaraciones: dict | None = None
    receta_encontrada: bool = False
    mensaje: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
