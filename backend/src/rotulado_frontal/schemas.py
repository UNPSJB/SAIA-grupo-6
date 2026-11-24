from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.rotulado_frontal import constants as c

ClaveMarca = Literal["azucares", "grasas", "sodio", "edulcorantes", "cafeina"]
EstadoRotulado = Literal[
    "sin_definir",
    "no_aplica",
    "no_aplica_canal_industrial",
    "exceptuado",
    "aplica",
    "modulo_inactivo",
]
OrigenMarca = Literal["receta", "correccion"]
CanalComercializacion = Literal["MINORISTA", "MAYORISTA", "MAYORISTA_INDUSTRIAL"]


def _limpiar_lista(valores: list[str], etiqueta: str) -> list[str]:
    limpias: list[str] = []
    for valor in valores:
        nombre = valor.strip()
        if not nombre:
            continue
        if len(nombre) > 80:
            raise ValueError(f"{etiqueta} debe tener hasta 80 caracteres.")
        if nombre not in limpias:
            limpias.append(nombre)
    return limpias


class ParametroNormativo(BaseModel):
    """Parámetro numérico versionado (umbral o factor de fórmula).

    La clave y la etiqueta permiten agregar parámetros nuevos sin tocar el
    código; el valor y la unidad quedan congelados en la instantánea.
    """

    clave: str = Field(min_length=1, max_length=80)
    etiqueta: str = Field(min_length=1, max_length=120)
    valor: float = Field(ge=0)
    unidad: str = Field(default="", max_length=40)

    @field_validator("clave", "etiqueta", "unidad")
    @classmethod
    def limpiar_texto(cls, valor: str) -> str:
        return valor.strip()


OperadorAplicabilidad = Literal[
    "es_verdadero",
    "es_falso",
    "es_nulo",
    "no_es_nulo",
    "igual",
    "distinto",
]


class CondicionAplicabilidad(BaseModel):
    campo: str = Field(min_length=1, max_length=80)
    operador: OperadorAplicabilidad
    valor: Any = None


class CategoriaExceptuada(BaseModel):
    clave: str = Field(min_length=1, max_length=80)
    etiqueta: str = Field(min_length=1, max_length=120)

    @field_validator("clave", "etiqueta")
    @classmethod
    def limpiar_texto(cls, valor: str) -> str:
        return valor.strip()


class CondicionReglaAplicabilidad(BaseModel):
    clave: str = Field(min_length=1, max_length=80)
    cuando: list[CondicionAplicabilidad] = Field(min_length=1)
    estado: EstadoRotulado
    mensaje: str = Field(min_length=1)
    faltantes: list[str] = Field(default_factory=list)
    incluir_marcas_pendientes: bool = False
    mensaje_extra_marcas: str | None = None


class ResultadoReglaAplicabilidad(BaseModel):
    """Resultado que se usa cuando ninguna condición de la regla coincide."""

    clave: str = Field(min_length=1, max_length=80)
    estado: EstadoRotulado
    mensaje: str = Field(min_length=1)
    faltantes: list[str] = Field(default_factory=list)
    incluir_marcas_pendientes: bool = False
    mensaje_extra_marcas: str | None = None


def _evaluar_perfil_inicial() -> list[CondicionAplicabilidad]:
    return [
        CondicionAplicabilidad.model_validate(condicion)
        for condicion in c.REGLAS_APLICABILIDAD_INICIALES[
            "evaluar_perfil_cuando"
        ]
    ]


class ReglasAplicabilidad(BaseModel):
    """Datos que ejecuta el motor de aplicabilidad.

    `condiciones` se evalúa en orden: la primera que se cumple define el
    estado. Para cambiar una regla de negocio se crea una versión nueva con
    otra lista; el servicio no conoce los casos particulares.
    """

    canales_consumo_final: list[str] = Field(min_length=1)
    categorias_exceptuadas: list[CategoriaExceptuada] = Field(default_factory=list)
    # Compatibilidad con reglas creadas antes de que el cruce de la receta
    # fuera configurable: si falta, se usa el comportamiento inicial.
    evaluar_perfil_cuando: list[CondicionAplicabilidad] = Field(
        default_factory=_evaluar_perfil_inicial,
        min_length=1,
    )
    condiciones: list[CondicionReglaAplicabilidad] = Field(min_length=1)
    resultado_por_defecto: ResultadoReglaAplicabilidad

    @field_validator("condiciones")
    @classmethod
    def validar_condiciones(
        cls, valores: list[CondicionReglaAplicabilidad]
    ) -> list[CondicionReglaAplicabilidad]:
        claves: set[str] = set()
        for condicion in valores:
            if condicion.clave in claves:
                raise ValueError(
                    f"La condición '{condicion.clave}' está repetida."
                )
            claves.add(condicion.clave)
        return valores

    @field_validator("categorias_exceptuadas")
    @classmethod
    def validar_categorias(
        cls, valores: list[CategoriaExceptuada]
    ) -> list[CategoriaExceptuada]:
        claves: set[str] = set()
        for categoria in valores:
            if categoria.clave in claves:
                raise ValueError(
                    f"La categoría '{categoria.clave}' está repetida."
                )
            claves.add(categoria.clave)
        return valores


def _reglas_aplicabilidad_iniciales() -> ReglasAplicabilidad:
    return ReglasAplicabilidad.model_validate(c.REGLAS_APLICABILIDAD_INICIALES)


def _validar_parametros(
    valores: list[ParametroNormativo], etiqueta: str
) -> list[ParametroNormativo]:
    claves: set[str] = set()
    for parametro in valores:
        if parametro.clave in claves:
            raise ValueError(f"{etiqueta}: la clave '{parametro.clave}' está repetida.")
        claves.add(parametro.clave)
    return valores


def _parametros_iniciales(valores: tuple[dict, ...]) -> list[ParametroNormativo]:
    return [ParametroNormativo(**parametro) for parametro in valores]


TipoCalculoSello = Literal["proporcion_energia", "mg_por_kcal", "valor_absoluto"]


class SelloDefinicion(BaseModel):
    """Definición versionada de un sello de advertencia.

    Dice qué nutriente se compara y con qué tipo de cálculo. Las claves de
    umbral y fórmula apuntan a los parámetros de la misma versión de la regla.
    """

    clave: str = Field(min_length=1, max_length=80)
    etiqueta: str = Field(min_length=1, max_length=120)
    tipo: TipoCalculoSello
    nutriente: str = Field(min_length=1, max_length=80)
    unidad_nutriente: str = Field(default="", max_length=40)
    umbral: str | None = Field(default=None, max_length=80)
    formula: str | None = Field(default=None, max_length=80)
    umbral_solido: str | None = Field(default=None, max_length=80)
    umbral_liquido: str | None = Field(default=None, max_length=80)
    criterio: str = Field(min_length=1, max_length=240)

    @field_validator(
        "clave",
        "etiqueta",
        "nutriente",
        "unidad_nutriente",
        "umbral",
        "formula",
        "umbral_solido",
        "umbral_liquido",
        "criterio",
    )
    @classmethod
    def limpiar_texto(cls, valor: str | None) -> str | None:
        return valor.strip() if valor is not None else None

    @model_validator(mode="after")
    def validar_referencias(self) -> "SelloDefinicion":
        if self.tipo == "proporcion_energia" and not (self.umbral and self.formula):
            raise ValueError(
                f"El sello '{self.clave}' necesita umbral y fórmula energética."
            )
        if self.tipo == "mg_por_kcal" and not self.umbral:
            raise ValueError(f"El sello '{self.clave}' necesita un umbral.")
        if self.tipo == "valor_absoluto" and not (
            self.umbral_solido and self.umbral_liquido
        ):
            raise ValueError(
                f"El sello '{self.clave}' necesita umbral para sólidos y líquidos."
            )
        return self


def _sellos_iniciales(valores: tuple[dict, ...]) -> list[SelloDefinicion]:
    return [SelloDefinicion(**sello) for sello in valores]


class PasoCalculoSello(BaseModel):
    """Un renglón del cálculo que se muestra al usuario."""

    descripcion: str
    valor: Decimal | None = None
    unidad: str = ""


class ResultadoSello(BaseModel):
    clave: str
    etiqueta: str
    tipo: TipoCalculoSello
    criterio: str
    nutriente: str
    nombre_nutriente: str
    unidad_nutriente: str
    valor_nutriente: Decimal | None
    valor_calculado: Decimal | None
    unidad_calculado: str
    umbral: Decimal | None
    unidad_umbral: str
    formula: str | None = None
    pasos: list[PasoCalculoSello] = Field(default_factory=list)
    exceso: bool | None = None
    evaluado: bool = False
    motivo: str | None = None
    # A menos de la tolerancia de homologación del umbral: las marcas aprobadas
    # pueden apartarse de la especificación en esa proporción, así que el sello
    # podría no corresponder (o faltar) en el producto real.
    cerca_del_umbral: bool = False
    distancia_umbral_pct: Decimal | None = None


class SellosRotulado(BaseModel):
    """Resultado versionado del cálculo de sellos de una evaluación."""

    evaluado: bool
    completo: bool
    motivo: str | None = None
    excesos: list[str] = Field(default_factory=list)
    resultados: list[ResultadoSello] = Field(default_factory=list)
    # Etiquetas de los sellos cerca del umbral y la tolerancia con que se midió.
    cerca_del_umbral: list[str] = Field(default_factory=list)
    tolerancia_pct: Decimal | None = None
    regla_version: int
    vigencia_desde: date
    norma_origen: str


class ReglaRotuladoIn(BaseModel):
    vigencia_desde: date
    norma_origen: str = Field(min_length=1, max_length=200)
    requiere_envasado: bool = True
    obliga_azucares: bool = True
    obliga_grasas: bool = True
    obliga_sodio: bool = True
    obliga_edulcorantes: bool = True
    obliga_cafeina: bool = True
    clases_edulcorante: list[str] = Field(default_factory=lambda: list(c.CLASES_EDULCORANTE_INICIAL))
    validar_ins_edulcorantes: bool = True
    ins_edulcorantes: list[str] = Field(
        default_factory=lambda: list(c.INS_EDULCORANTES_INICIAL)
    )
    ingredientes_cafeina: list[str] = Field(
        default_factory=lambda: list(c.INGREDIENTES_CON_CAFEINA_INICIAL)
    )
    umbrales_sellos: list[ParametroNormativo] = Field(
        default_factory=lambda: _parametros_iniciales(c.UMBRALES_SELLOS_INICIALES)
    )
    formulas_nutricionales: list[ParametroNormativo] = Field(
        default_factory=lambda: _parametros_iniciales(
            c.FORMULAS_NUTRICIONALES_INICIALES
        )
    )
    sellos: list[SelloDefinicion] = Field(
        default_factory=lambda: _sellos_iniciales(c.SELLOS_INICIALES),
        min_length=1,
    )
    reglas_aplicabilidad: ReglasAplicabilidad = Field(
        default_factory=_reglas_aplicabilidad_iniciales
    )

    @field_validator("norma_origen")
    @classmethod
    def validar_norma(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("La norma de origen no puede estar vacía.")
        return limpio

    @field_validator("clases_edulcorante")
    @classmethod
    def validar_clases(cls, valores: list[str]) -> list[str]:
        return _limpiar_lista(valores, "Cada clase funcional")

    @field_validator("ins_edulcorantes")
    @classmethod
    def validar_ins(cls, valores: list[str]) -> list[str]:
        return _limpiar_lista(valores, "Cada código INS")

    @field_validator("ingredientes_cafeina")
    @classmethod
    def validar_ingredientes_cafeina(cls, valores: list[str]) -> list[str]:
        return _limpiar_lista(valores, "Cada ingrediente con cafeína")

    @field_validator("umbrales_sellos")
    @classmethod
    def validar_umbrales(
        cls, valores: list[ParametroNormativo]
    ) -> list[ParametroNormativo]:
        return _validar_parametros(valores, "Umbrales de sellos")

    @field_validator("formulas_nutricionales")
    @classmethod
    def validar_formulas(
        cls, valores: list[ParametroNormativo]
    ) -> list[ParametroNormativo]:
        return _validar_parametros(valores, "Fórmulas nutricionales")

    @field_validator("sellos")
    @classmethod
    def validar_sellos(
        cls, valores: list[SelloDefinicion]
    ) -> list[SelloDefinicion]:
        claves: set[str] = set()
        for sello in valores:
            if sello.clave in claves:
                raise ValueError(f"El sello '{sello.clave}' está repetido.")
            claves.add(sello.clave)
        return valores


class ReglaRotuladoResponse(ReglaRotuladoIn):
    id: int
    version: int
    vigente: bool
    programada: bool
    creado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class ConfiguracionRotuladoIn(BaseModel):
    """`None` deja que la marca se deduzca de la receta."""

    envasado_sin_cliente: bool | None = None
    azucares_agregados: bool | None = None
    grasas_agregadas: bool | None = None
    sodio_agregado: bool | None = None
    edulcorantes: bool | None = None
    cafeina: bool | None = None
    canal_comercializacion: CanalComercializacion | None = None
    # Son atributos del producto, no de la configuración: se envían por este
    # endpoint para que el administrador los defina desde la misma pantalla.
    categoria_rotulado: str | None = Field(default=None, max_length=80)
    categoria_exceptuada_por_ley: bool | None = None


class ConfiguracionRotuladoResponse(BaseModel):
    configurada: bool
    envasado_sin_cliente: bool | None
    azucares_agregados: bool | None
    grasas_agregadas: bool | None
    sodio_agregado: bool | None
    edulcorantes: bool | None
    cafeina: bool | None
    canal_comercializacion: CanalComercializacion


class FuenteMarca(BaseModel):
    ingrediente_id: int
    nombre: str
    # Con valor por defecto: las instantáneas guardadas antes del cambio no lo traen.
    es_aditivo: bool = False
    motivo: str


class MarcaRotulado(BaseModel):
    clave: ClaveMarca
    nombre: str
    obligatoria: bool
    valor: bool | None
    origen: OrigenMarca | None
    resuelta: bool
    fuentes: list[FuenteMarca]


class VersionRotuladoResumen(BaseModel):
    id: int
    numero: int
    rendimiento: Decimal
    unidad: str


class VersionRecetaHistorial(BaseModel):
    """Versión de la receta con quién y cuándo la creó, para el historial."""

    id: int
    numero: int
    rendimiento: Decimal
    unidad: str
    porcion_descripcion: str | None = None
    porcion_cantidad: Decimal | None = None
    creado_en: datetime
    creado_por_id: int | None = None
    creado_por_nombre: str | None = None
    vigente: bool = False


class AjusteModuloRotuladoIn(BaseModel):
    modulo_activo: bool


class AjusteModuloRotuladoResponse(BaseModel):
    modulo_activo: bool
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class InstantaneaParametrosRotulado(BaseModel):
    """Copia completa de los parámetros usados en una evaluación."""

    model_config = ConfigDict(frozen=True)

    regla_id: int
    regla_version: int
    vigente: bool
    vigencia_desde: date
    norma_origen: str
    requiere_envasado: bool
    obliga_azucares: bool
    obliga_grasas: bool
    obliga_sodio: bool
    obliga_edulcorantes: bool
    obliga_cafeina: bool
    clases_edulcorante: list[str]
    validar_ins_edulcorantes: bool
    ins_edulcorantes: list[str]
    ingredientes_cafeina: list[str]
    umbrales_sellos: list[ParametroNormativo]
    formulas_nutricionales: list[ParametroNormativo]
    sellos: list[SelloDefinicion] | None = None
    reglas_aplicabilidad: ReglasAplicabilidad


class InstantaneaRotulado(BaseModel):
    """Foto inmutable para guardar en un lote de producción.

    Congela la decisión, los parámetros normativos completos y las versiones de
    la regla y de la receta que la originaron. Aunque después cambie la fórmula
    o se active otra regla, el historial del lote conserva exactamente lo
    evaluado y con qué parámetros se hizo.
    """

    model_config = ConfigDict(frozen=True)

    version_esquema: int = 6
    evaluado_en: datetime
    estado: EstadoRotulado
    mensaje: str
    modulo_activo: bool
    parametros: InstantaneaParametrosRotulado
    sellos: SellosRotulado | None = None
    regla_id: int
    regla_version: int
    norma_origen: str
    receta_id: int | None
    version_receta_id: int | None
    version_receta_numero: int | None
    configuracion: ConfiguracionRotuladoResponse
    categoria_rotulado: str | None
    categoria_exceptuada_por_ley: bool
    canal_comercializacion: CanalComercializacion
    envasado_sin_cliente: bool | None
    faltantes: list[str]
    advertencias: list[str]
    marcas: list[MarcaRotulado]


class EvaluacionRotuladoResponse(BaseModel):
    producto_id: int
    producto: str
    receta_id: int | None
    version: VersionRotuladoResumen | None
    regla: ReglaRotuladoResponse
    configuracion: ConfiguracionRotuladoResponse
    categoria_rotulado: str | None
    categoria_exceptuada_por_ley: bool
    modulo_activo: bool
    estado: EstadoRotulado
    mensaje: str
    faltantes: list[str]
    advertencias: list[str]
    marcas: list[MarcaRotulado]
    # False cuando la regla no manda cruzar la receta (categoría exceptuada,
    # producto no envasado, módulo inactivo...): las marcas quedan sin dato a
    # propósito y la pantalla lo explica en vez de mostrar "Sin dato".
    perfil_evaluado: bool = True
    sellos: SellosRotulado
    evaluado_en: datetime
    instantanea: InstantaneaRotulado
    versiones_receta: list[VersionRecetaHistorial] = Field(default_factory=list)


class EvaluacionRotuladoGuardadaResponse(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    receta_id: int | None
    version_receta_id: int | None
    regla_id: int
    regla_version: int
    norma_origen: str
    estado: EstadoRotulado
    mensaje: str
    evaluado_en: datetime
    instantanea: InstantaneaRotulado

    model_config = ConfigDict(from_attributes=True)
