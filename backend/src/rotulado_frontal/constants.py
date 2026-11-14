"""E12: aplicabilidad y sellos del rotulado frontal.

La aplicabilidad decide si la normativa aplica, si el producto queda
exceptuado o si falta información para responder. Cuando aplica, los sellos
se calculan con los valores de E11 y los parámetros de la regla vigente.
"""

from datetime import date

AZUCARES = "azucares"
GRASAS = "grasas"
SODIO = "sodio"
EDULCORANTES = "edulcorantes"
CAFEINA = "cafeina"

CLAVES_MARCA = (AZUCARES, GRASAS, SODIO, EDULCORANTES, CAFEINA)

NOMBRES_MARCA = {
    AZUCARES: "Azúcares agregados",
    GRASAS: "Grasas agregadas",
    SODIO: "Sodio agregado",
    EDULCORANTES: "Edulcorantes",
    CAFEINA: "Cafeína",
}

AYUDAS_MARCA = {
    AZUCARES: "Azúcar, miel, jarabes, dulce de leche o cualquier ingrediente con azúcar añadido.",
    GRASAS: "Grasas o aceites agregados como ingrediente, no las grasas propias del alimento.",
    SODIO: "Sal, sodio o aditivos que aportan sodio de forma relevante.",
    EDULCORANTES: "Aditivos de clase funcional edulcorante o ingredientes que los contengan.",
    CAFEINA: "Cafeína agregada o ingredientes que la aporten (café, té, guaraná).",
}

# Campo de la configuración del producto que guarda la corrección manual.
CAMPO_CONFIGURACION = {
    AZUCARES: "azucares_agregados",
    GRASAS: "grasas_agregadas",
    SODIO: "sodio_agregado",
    EDULCORANTES: "edulcorantes",
    CAFEINA: "cafeina",
}

# Campo del perfil nutricional del insumo que trae la marca.
CAMPO_PERFIL = {
    AZUCARES: "azucares_son_anadidos",
    GRASAS: "grasas_son_anadidas",
    SODIO: "sodio_es_anadido",
    EDULCORANTES: "contiene_edulcorantes",
    CAFEINA: "contiene_cafeina",
}

# Flag de la regla que indica si la marca obliga a rotular.
CAMPO_OBLIGA = {
    AZUCARES: "obliga_azucares",
    GRASAS: "obliga_grasas",
    SODIO: "obliga_sodio",
    EDULCORANTES: "obliga_edulcorantes",
    CAFEINA: "obliga_cafeina",
}

ESTADO_SIN_DEFINIR = "sin_definir"
ESTADO_NO_APLICA = "no_aplica"
ESTADO_NO_APLICA_CANAL_INDUSTRIAL = "no_aplica_canal_industrial"
ESTADO_EXCEPTUADO = "exceptuado"
ESTADO_APLICA = "aplica"
ESTADO_MODULO_INACTIVO = "modulo_inactivo"

ESTADOS = (
    ESTADO_SIN_DEFINIR,
    ESTADO_NO_APLICA,
    ESTADO_NO_APLICA_CANAL_INDUSTRIAL,
    ESTADO_EXCEPTUADO,
    ESTADO_APLICA,
    ESTADO_MODULO_INACTIVO,
)

CANAL_MINORISTA = "MINORISTA"
CANAL_MAYORISTA = "MAYORISTA"
CANAL_MAYORISTA_INDUSTRIAL = "MAYORISTA_INDUSTRIAL"

CANALES_COMERCIALIZACION = (
    CANAL_MINORISTA,
    CANAL_MAYORISTA,
    CANAL_MAYORISTA_INDUSTRIAL,
)

# Solo el canal minorista es consumo final directo: los demás canales no
# llevan rotulado frontal en el empaque del producto.
CANALES_CONSUMO_FINAL = (CANAL_MINORISTA,)

ORIGEN_RECETA = "receta"
ORIGEN_CORRECCION = "correccion"

MOTIVO_PERFIL = "marca del insumo"
MOTIVO_CLASE = "clase funcional"
MOTIVO_CAFEINA_INTRINSECA = "cafeína intrínseca del ingrediente"

# Valores iniciales de la regla. En tiempo de ejecución los listados se leen
# desde la versión de la regla vigente, no desde estas constantes.
INS_EDULCORANTES_INICIAL = (
    "420",
    "421",
    "422",
    "950",
    "951",
    "952",
    "953",
    "954",
    "955",
    "956",
    "957",
    "958",
    "959",
    "960",
    "961",
    "962",
    "963",
    "964",
    "965",
    "966",
    "967",
    "968",
    "969",
)

# Materias primas compuestas que aportan cafeína intrínseca. Se comparan por
# palabra completa (normalizada) para no confundir, por ejemplo, "tomate" con
# "mate".
INGREDIENTES_CON_CAFEINA_INICIAL = (
    "cafe",
    "cafeina",
    "te",
    "te verde",
    "te negro",
    "te blanco",
    "guarana",
    "yerba mate",
    "mate cocido",
    "guayusa",
)

NORMATIVA_INICIAL = "Ley 27.642 y Decreto 151/2022"
VIGENCIA_INICIAL = date(2022, 3, 23)
CLASES_EDULCORANTE_INICIAL = ["Edulcorante"]

# Parametros iniciales del modulo de octogonos. Son solo la carga inicial:
# en tiempo de ejecucion se leen de la version de la regla vigente y se
# pueden cambiar desde la pantalla sin reprogramar. Los valores quedan
# expresados en la unidad indicada para que el futuro calculo de sellos no
# dependa de constantes del codigo.
UMBRALES_SELLOS_INICIALES = (
    {
        "clave": "energia_solidos",
        "etiqueta": "Energia en solidos",
        "valor": 275.0,
        "unidad": "kcal/100 g",
    },
    {
        "clave": "energia_liquidos",
        "etiqueta": "Energia en liquidos",
        "valor": 70.0,
        "unidad": "kcal/100 ml",
    },
    {
        "clave": "azucares_energia",
        "etiqueta": "Azucares agregados sobre energia",
        "valor": 10.0,
        "unidad": "% de energia",
    },
    {
        "clave": "grasas_totales_energia",
        "etiqueta": "Grasas totales sobre energia",
        "valor": 30.0,
        "unidad": "% de energia",
    },
    {
        "clave": "grasas_saturadas_energia",
        "etiqueta": "Grasas saturadas sobre energia",
        "valor": 10.0,
        "unidad": "% de energia",
    },
    {
        "clave": "sodio_mg_kcal",
        "etiqueta": "Sodio por energia",
        "valor": 1.0,
        "unidad": "mg/kcal",
    },
)

FORMULAS_NUTRICIONALES_INICIALES = (
    {
        "clave": "kcal_por_g_azucares",
        "etiqueta": "Energia por gramo de azucares",
        "valor": 4.0,
        "unidad": "kcal/g",
    },
    {
        "clave": "kcal_por_g_grasas",
        "etiqueta": "Energia por gramo de grasas",
        "valor": 9.0,
        "unidad": "kcal/g",
    },
    {
        "clave": "kcal_por_g_grasas_saturadas",
        "etiqueta": "Energia por gramo de grasas saturadas",
        "valor": 9.0,
        "unidad": "kcal/g",
    },
)

# Definición estructural de cada sello. Los valores numéricos (umbrales y
# factores) NO viven acá: se leen de `umbrales_sellos` y
# `formulas_nutricionales` de la versión vigente. Esta lista solo dice qué
# nutriente compara cada sello y con qué tipo de cálculo.
TIPOS_CALCULO_SELLO = ("proporcion_energia", "mg_por_kcal", "valor_absoluto")

SELLOS = (
    {
        "clave": "azucares",
        "etiqueta": "Exceso en azúcares",
        "tipo": "proporcion_energia",
        "nutriente": "azucares_anadidos",
        "unidad_nutriente": "g",
        "umbral": "azucares_energia",
        "formula": "kcal_por_g_azucares",
        "criterio": "Azúcares añadidos sobre la energía total",
    },
    {
        "clave": "grasas_totales",
        "etiqueta": "Exceso en grasas totales",
        "tipo": "proporcion_energia",
        "nutriente": "grasas_totales",
        "unidad_nutriente": "g",
        "umbral": "grasas_totales_energia",
        "formula": "kcal_por_g_grasas",
        "criterio": "Grasas totales sobre la energía total",
    },
    {
        "clave": "grasas_saturadas",
        "etiqueta": "Exceso en grasas saturadas",
        "tipo": "proporcion_energia",
        "nutriente": "grasas_saturadas",
        "unidad_nutriente": "g",
        "umbral": "grasas_saturadas_energia",
        "formula": "kcal_por_g_grasas_saturadas",
        "criterio": "Grasas saturadas sobre la energía total",
    },
    {
        "clave": "sodio",
        "etiqueta": "Exceso en sodio",
        "tipo": "mg_por_kcal",
        "nutriente": "sodio",
        "unidad_nutriente": "mg",
        "umbral": "sodio_mg_kcal",
        "criterio": "Sodio por energía",
    },
    {
        "clave": "calorias",
        "etiqueta": "Exceso en calorías",
        "tipo": "valor_absoluto",
        "nutriente": "energia",
        "unidad_nutriente": "kcal",
        "umbral_solido": "energia_solidos",
        "umbral_liquido": "energia_liquidos",
        "criterio": "Energía por 100 g o 100 ml, según se exprese el producto",
    },
)

CLAVE_MIGRACION = "rotulado_frontal_regla_v1"

MENSAJE_MODULO_INACTIVO = (
    "El modulo de octogonos esta desactivado. No se evalua el rotulado frontal "
    "ni se calculan sellos; el resto del sistema sigue funcionando normalmente."
)
MENSAJE_FALTA_ENVASADO = (
    "Falta indicar si el producto se comercializa envasado en ausencia del cliente."
)
MENSAJE_NO_APLICA = (
    "El producto no se comercializa envasado en ausencia del cliente: no corresponde "
    "el rotulado frontal y no se calculan sellos."
)
MENSAJE_NO_APLICA_CANAL_INDUSTRIAL = (
    "El producto se destina a un canal que no es de consumo final directo "
    "(industrial o mayorista): no se evalúa el rotulado frontal del empaque."
)
MENSAJE_EXCEPTUADO = (
    "El producto se comercializa envasado y no tiene azúcares, grasas ni sodio "
    "agregados, ni edulcorantes ni cafeína: queda exceptuado del rotulado frontal."
)
MENSAJE_EXCEPTUADO_POR_NATURALEZA = (
    "El producto pertenece a una categoría exceptuada por el artículo 9 de la "
    "Ley 27.642 (por ejemplo, azúcar común, aceites vegetales, frutos secos o sal "
    "común de mesa): queda exceptuado del rotulado frontal sin evaluar su perfil."
)
MENSAJE_APLICA = (
    "El producto se comercializa envasado y presenta marcas de rotulado frontal: "
    "corresponde el rotulado frontal y se calculan sus sellos."
)
MENSAJE_SELLOS_NO_EVALUADOS = (
    "No se calculan sellos porque la evaluación no llegó a la instancia de rotulado."
)
MENSAJE_FALTAN_MARCAS = (
    "Falta definir marcas del producto antes de saber si corresponde el rotulado frontal."
)

ADVERTENCIA_SIN_RECETA = (
    "El producto no tiene receta: las marcas se basan solo en las correcciones manuales."
)
ADVERTENCIA_SIN_VERSION = (
    "La receta no tiene versiones: las marcas se basan solo en las correcciones manuales."
)

# Categorías exceptuadas y reglas de aplicación iniciales. Igual que los
# umbrales, son solo la carga inicial: el motor lee esta estructura desde la
# versión vigente de la regla y no conoce ningún caso particular.
CATEGORIAS_EXCEPTUADAS_INICIALES = (
    {"clave": "azucar_comun", "etiqueta": "Azúcar común"},
    {"clave": "aceites_vegetales", "etiqueta": "Aceites vegetales"},
    {"clave": "frutos_secos", "etiqueta": "Frutos secos"},
    {"clave": "sal_comun", "etiqueta": "Sal común de mesa"},
    {"clave": "otra_exceptuada", "etiqueta": "Otra categoría exceptuada"},
)

RESULTADO_APLICABILIDAD_INICIAL = {
    "clave": "resultado_por_defecto",
    "estado": ESTADO_SIN_DEFINIR,
    "mensaje": f"{MENSAJE_FALTAN_MARCAS} Falta: {{marcas}}.",
    "faltantes": [],
    "incluir_marcas_pendientes": True,
}

REGLAS_APLICABILIDAD_INICIALES = {
    "canales_consumo_final": list(CANALES_CONSUMO_FINAL),
    "categorias_exceptuadas": [
        dict(categoria) for categoria in CATEGORIAS_EXCEPTUADAS_INICIALES
    ],
    "resultado_por_defecto": dict(RESULTADO_APLICABILIDAD_INICIAL),
    "evaluar_perfil_cuando": [
        {"campo": "modulo_activo", "operador": "es_verdadero"},
        {"campo": "canal_consumo_final", "operador": "es_verdadero"},
        {"campo": "categoria_exceptuada", "operador": "es_falso"},
    ],
    "condiciones": [
        {
            "clave": "modulo_inactivo",
            "cuando": [{"campo": "modulo_activo", "operador": "es_falso"}],
            "estado": ESTADO_MODULO_INACTIVO,
            "mensaje": MENSAJE_MODULO_INACTIVO,
        },
        {
            "clave": "canal_no_consumo_final",
            "cuando": [{"campo": "canal_consumo_final", "operador": "es_falso"}],
            "estado": ESTADO_NO_APLICA_CANAL_INDUSTRIAL,
            "mensaje": MENSAJE_NO_APLICA_CANAL_INDUSTRIAL,
        },
        {
            "clave": "excepcion_por_naturaleza",
            "cuando": [{"campo": "categoria_exceptuada", "operador": "es_verdadero"}],
            "estado": ESTADO_EXCEPTUADO,
            "mensaje": MENSAJE_EXCEPTUADO_POR_NATURALEZA,
        },
        {
            "clave": "no_envasado",
            "cuando": [{"campo": "envasado", "operador": "es_falso"}],
            "estado": ESTADO_NO_APLICA,
            "mensaje": MENSAJE_NO_APLICA,
        },
        {
            "clave": "falta_envasado",
            "cuando": [{"campo": "envasado", "operador": "es_nulo"}],
            "estado": ESTADO_SIN_DEFINIR,
            "mensaje": MENSAJE_FALTA_ENVASADO,
            "faltantes": [
                "si se comercializa envasado en ausencia del cliente"
            ],
            "incluir_marcas_pendientes": True,
            "mensaje_extra_marcas": "También faltan marcas: {marcas}.",
        },
        {
            "clave": "alguna_marca_obligatoria",
            "cuando": [
                {"campo": "alguna_marca_obligatoria", "operador": "es_verdadero"}
            ],
            "estado": ESTADO_APLICA,
            "mensaje": MENSAJE_APLICA,
        },
        {
            "clave": "faltan_marcas",
            "cuando": [
                {"campo": "hay_marcas_pendientes", "operador": "es_verdadero"}
            ],
            "estado": ESTADO_SIN_DEFINIR,
            "mensaje": f"{MENSAJE_FALTAN_MARCAS} Falta: {{marcas}}.",
            "incluir_marcas_pendientes": True,
        },
        {
            "clave": "sin_marcas",
            "cuando": [{"campo": "siempre", "operador": "es_verdadero"}],
            "estado": ESTADO_EXCEPTUADO,
            "mensaje": MENSAJE_EXCEPTUADO,
        },
    ],
}
