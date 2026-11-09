from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.common.validators import texto_opcional

Fuente = Literal["base_referencia", "rotulo_proveedor", "bibliografia", "valor_propio"]
Expresar = Literal["g", "ml"]
Positivo = Decimal


# ── Parámetros ─────────────────────────────────────────────────────────────


class ParametroNutrienteSchema(BaseModel):
    clave: str
    nombre: str = Field(min_length=1, max_length=60)
    unidad: str
    orden: int
    valor_diario: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    umbral_no_significativo: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=3
    )
    decimales_menor_10: int = Field(ge=0, le=3)
    decimales_desde_10: int = Field(ge=0, le=3)
    # False: la norma no le fija Valor Diario (azúcares y grasas trans).
    admite_vd: bool = True

    model_config = ConfigDict(from_attributes=True)


class ParametroNutrienteUpdate(BaseModel):
    clave: str
    nombre: str = Field(min_length=1, max_length=60)
    valor_diario: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    umbral_no_significativo: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=3
    )
    decimales_menor_10: int = Field(ge=0, le=3)
    decimales_desde_10: int = Field(ge=0, le=3)


class ParametrosGenerales(BaseModel):
    mostrar_por_100: bool = True
    frase_no_significativo: bool = False


class LeyendasFijas(BaseModel):
    """Leyendas obligatorias: se muestran pero no se editan."""

    leyenda_calculo: str
    leyenda_vd: str


class ParametrosResponse(BaseModel):
    nutrientes: list[ParametroNutrienteSchema]
    generales: ParametrosGenerales
    leyendas_fijas: LeyendasFijas


class ParametrosUpdate(BaseModel):
    nutrientes: list[ParametroNutrienteUpdate]
    generales: ParametrosGenerales


# ── Base de composición ────────────────────────────────────────────────────


class AlimentoReferenciaResponse(BaseModel):
    id: int
    base: str
    codigo: str | None
    nombre: str
    energia: Decimal | None
    carbohidratos: Decimal | None
    azucares_totales: Decimal | None
    azucares_anadidos: Decimal | None
    proteinas: Decimal | None
    grasas_totales: Decimal | None
    grasas_saturadas: Decimal | None
    grasas_trans: Decimal | None
    fibra: Decimal | None
    sodio: Decimal | None

    model_config = ConfigDict(from_attributes=True)


class ResultadoImportacion(BaseModel):
    base: str
    creados: int
    actualizados: int
    errores: list[str]


# ── Datos nutricionales del insumo ─────────────────────────────────────────


class ValorIn(BaseModel):
    nutriente: str
    valor: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    fuente: Fuente
    referencia: str | None = Field(default=None, max_length=300)
    alimento_referencia_id: int | None = Field(default=None, gt=0)

    @field_validator("referencia")
    @classmethod
    def validar_referencia(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=300)


class DatosNutricionalesIn(BaseModel):
    peso_unidad_g: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)
    densidad_g_ml: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)
    aporta_energia_sodio: bool = False
    azucares_son_anadidos: bool = False
    # Los nutrientes que no vienen se borran: el formulario manda siempre todo.
    valores: list[ValorIn]


class ValorResponse(BaseModel):
    nutriente: str
    nombre: str
    unidad: str
    valor: Decimal
    fuente: str
    fuente_etiqueta: str
    referencia: str | None
    alimento_referencia_id: int | None
    valor_fuente: Decimal
    cargado_en: datetime
    cargado_por: str | None
    modificado: bool
    modificado_en: datetime | None
    modificado_por: str | None


class Completitud(BaseModel):
    completo: bool
    # Si el insumo no entra en la exigencia (aditivo sin aporte), se aclara.
    exige_datos: bool
    faltantes: list[str]


class DatosNutricionalesResponse(BaseModel):
    insumo_id: int
    nombre: str
    tipo: str
    unidad: str
    unidad_tipo: str | None
    peso_unidad_g: Decimal | None
    densidad_g_ml: Decimal | None
    aporta_energia_sodio: bool
    azucares_son_anadidos: bool
    nutrientes_admitidos: list[str]
    valores: list[ValorResponse]
    completitud: Completitud


class InsumoNutricionResumen(BaseModel):
    insumo_id: int
    nombre: str
    tipo: str
    completo: bool
    exige_datos: bool
    faltantes: list[str]


# ── Información nutricional del producto ───────────────────────────────────


class ConfiguracionProductoIn(BaseModel):
    expresar_en: Expresar = "g"
    porcion: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=3)
    medida_casera: str | None = Field(default=None, max_length=100)
    densidad_g_ml: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)
    peso_unidad_g: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=4)

    @field_validator("medida_casera")
    @classmethod
    def validar_medida(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=100)


class ConfiguracionProducto(ConfiguracionProductoIn):
    configurada: bool


class IngredienteCalculo(BaseModel):
    insumo_id: int
    nombre: str
    tipo: str
    cantidad: Decimal
    unidad: str
    gramos: Decimal | None
    exige_datos: bool
    completo: bool
    faltantes: list[str]
    # Si sus datos entran en la suma (un aditivo sin datos no suma nada).
    incluido: bool


class FilaTabla(BaseModel):
    clave: str
    nombre: str
    unidad: str
    por_100: Decimal | None
    por_porcion: Decimal | None
    vd: Decimal | None
    por_100_texto: str
    por_porcion_texto: str
    vd_texto: str
    no_significativo: bool
    vd_establecido: bool
    # Algún insumo no tiene este nutriente: la fila se muestra sin valores.
    faltan_datos: bool = False
    # El valor sale de un análisis del producto, no de los ingredientes.
    de_laboratorio: bool = False


class ValorLaboratorioIn(BaseModel):
    nutriente: str
    valor_100: Decimal = Field(ge=0, max_digits=14, decimal_places=4)


class LaboratorioIn(BaseModel):
    """Resultados de un análisis del producto. Lo que no viene se borra."""

    referencia: str | None = Field(default=None, max_length=300)
    fecha_analisis: date | None = None
    valores: list[ValorLaboratorioIn]

    @field_validator("referencia")
    @classmethod
    def validar_referencia(cls, valor: str | None) -> str | None:
        return texto_opcional(valor, largo_maximo=300)


class ValorLaboratorio(BaseModel):
    nutriente: str
    nombre: str
    unidad: str
    valor_100: Decimal
    referencia: str | None
    fecha_analisis: date | None
    cargado_en: datetime
    cargado_por: str | None


class VersionResumen(BaseModel):
    id: int
    numero: int
    rendimiento: Decimal
    unidad: str


class InfoNutricionalResponse(BaseModel):
    producto_id: int
    producto: str
    receta_id: int | None
    version: VersionResumen | None
    configuracion: ConfiguracionProducto
    estado: str
    problemas: list[str]
    ingredientes: list[IngredienteCalculo]
    incompletos: list[IngredienteCalculo]
    cantidad_base: Decimal | None
    expresar_en: str
    filas: list[FilaTabla]
    leyenda_calculo: str
    leyenda_vd: str
    leyenda_no_significativo: str | None
    leyenda_laboratorio: str
    mostrar_por_100: bool
    laboratorio: list[ValorLaboratorio]
    calculado_en: datetime
