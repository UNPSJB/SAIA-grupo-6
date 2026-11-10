"""E11: tabla de información nutricional.

Los nutrientes de declaración obligatoria son fijos (los pide la norma), pero
todo lo que define cómo se expresan —nombre, Valor Diario, redondeo, umbral de
"no significativo", leyendas— vive en la base (`parametros_nutrientes` y
`parametros_nutricion`) y se cambia desde la app. Los valores de acá son solo
la carga inicial.
"""

from decimal import Decimal

# ── Nutrientes ──────────────────────────────────────────────────────────────

ENERGIA = "energia"
SODIO = "sodio"
AZUCARES_TOTALES = "azucares_totales"
AZUCARES_ANADIDOS = "azucares_anadidos"
GRASAS_TOTALES = "grasas_totales"
GRASAS_SATURADAS = "grasas_saturadas"
GRASAS_TRANS = "grasas_trans"

# (clave, nombre, unidad, orden)
NUTRIENTES: tuple[tuple[str, str, str, int], ...] = (
    (ENERGIA, "Valor energético", "kcal", 1),
    ("carbohidratos", "Carbohidratos", "g", 2),
    ("azucares_totales", "Azúcares totales", "g", 3),
    ("azucares_anadidos", "Azúcares añadidos", "g", 4),
    ("proteinas", "Proteínas", "g", 5),
    ("grasas_totales", "Grasas totales", "g", 6),
    ("grasas_saturadas", "Grasas saturadas", "g", 7),
    ("grasas_trans", "Grasas trans", "g", 8),
    ("fibra", "Fibra alimentaria", "g", 9),
    (SODIO, "Sodio", "mg", 10),
)
CLAVES_NUTRIENTES: tuple[str, ...] = tuple(n[0] for n in NUTRIENTES)

# Nutrientes sin Valor Diario de Referencia: la tabla de VDR de la guía de
# rotulado (Res. GMC 46/03) no los incluye, y para las grasas trans la guía
# excluye expresamente el %VD. No se les puede cargar un VD desde la app: si
# la norma lo incorporara, hay que sacarlos de esta lista.
NUTRIENTES_SIN_VD: tuple[str, ...] = (AZUCARES_TOTALES, AZUCARES_ANADIDOS, GRASAS_TRANS)

# Lo único que admite un aditivo (bicarbonato, conservantes con sodio...).
NUTRIENTES_ADITIVO: tuple[str, ...] = (ENERGIA, SODIO)

# Carga inicial de los parámetros por nutriente:
# clave -> (valor diario, umbral "no significativo" por porción,
#           decimales si el valor es < 10, decimales si es >= 10)
# Referencia: Res. GMC 46/03 y 47/03 (MERCOSUR), incorporadas al CAA, y la
# Guía de Rotulado (ANMAT, act. enero 2025) que entregó la cátedra: valores
# >= 10 en enteros, entre 1 y 10 con un decimal, menores a 1 con un decimal.
# Azúcares y grasas trans no tienen Valor Diario (el %VD queda en blanco).
PARAMETROS_INICIALES: dict[str, tuple[Decimal | None, Decimal | None, int, int]] = {
    ENERGIA: (Decimal("2000"), Decimal("4"), 1, 0),
    "carbohidratos": (Decimal("300"), Decimal("0.5"), 1, 0),
    "azucares_totales": (None, Decimal("0.5"), 1, 0),
    "azucares_anadidos": (None, Decimal("0.5"), 1, 0),
    "proteinas": (Decimal("75"), Decimal("0.5"), 1, 0),
    "grasas_totales": (Decimal("55"), Decimal("0.5"), 1, 0),
    "grasas_saturadas": (Decimal("22"), Decimal("0.2"), 1, 0),
    "grasas_trans": (None, Decimal("0.2"), 1, 0),
    "fibra": (Decimal("25"), Decimal("0.5"), 1, 0),
    SODIO: (Decimal("2400"), Decimal("5"), 1, 0),
}

# ── Parámetros generales ───────────────────────────────────────────────────

MOSTRAR_POR_100 = "mostrar_por_100"
FRASE_NO_SIGNIFICATIVO = "frase_no_significativo"

PARAMETROS_GENERALES_INICIALES: dict[str, str] = {
    # La norma exige "por porción" y %VD; la columna por 100 g/ml es optativa.
    MOSTRAR_POR_100: "1",
    # Frase de "no significativo": activada. La tabla igual declara esos
    # nutrientes como "0,0" (rótulo de la cátedra) y la frase los nombra al pie
    # (Guía de Rotulado): así se cumplen las dos referencias.
    FRASE_NO_SIGNIFICATIVO: "1",
}
CLAVES_GENERALES: tuple[str, ...] = tuple(PARAMETROS_GENERALES_INICIALES)

# Leyendas obligatorias: texto FIJO, no se editan desde la app. Si fueran
# parámetros, cualquiera con permiso de administrar podría vaciarlas o
# cambiarles el sentido, y dejarían de proteger a quien lee la tabla.
#
# * La de valores calculados la exige la historia "Ver tabla en formato
#   normativo" (E11) y acompaña a la tabla en pantalla, impresión y PDF.
# * La del %VD la fija la Guía de Rotulado (modelos de tabla): "Se debe
#   agregar como parte de la información nutricional la siguiente expresión".
# Factor de conversión de la energía: el que da "2.000 kcal u 8.400 kJ" en la
# leyenda del %VD y "235 kcal = 989 kJ" en el rótulo de referencia de la
# cátedra. Fijo por la misma razón que las leyendas.
FACTOR_KJ_FIJO = Decimal("4.2")

# Nota de los valores que salen de un análisis del producto: van marcados **
# y la nota tiene que estar siempre que aparezca la marca (texto del rótulo de
# referencia de la cátedra).
LEYENDA_LABORATORIO_FIJA = "** Determinado en laboratorio."

LEYENDA_CALCULO_FIJA = (
    "Valores calculados a partir de datos de composición de referencia. "
    "Deben ser revisados por un/a profesional antes de usarse en un rótulo."
)
LEYENDA_VD_FIJA = (
    "* % Valores Diarios con base a una dieta de 2.000 kcal u 8.400 kJ. "
    "Sus valores diarios pueden ser mayores o menores dependiendo de sus "
    "necesidades energéticas."
)
# Claves que fueron parámetros editables antes de fijar el texto: la
# migración las borra de `parametros_nutricion`.
# La nota de "VD no establecido" no la piden las historias ni la guía: el %VD
# de azúcares y grasas trans va en blanco, sin nota (rótulo de la cátedra).
CLAVES_GENERALES_RETIRADAS: tuple[str, ...] = (
    "leyenda_calculo",
    "leyenda_vd",
    "factor_kj",
    "leyenda_vd_no_establecido",
    # Era un texto libre; ahora es una casilla con el texto fijo de la guía.
    "texto_no_significativo",
    # Obligatoria si hay valores de laboratorio: texto fijo.
    "leyenda_laboratorio",
)

# Valores iniciales anteriores: si nadie los cambió, la migración los
# reemplaza por los de la guía de la cátedra (una sola vez).
# clave -> (valor inicial viejo, valor que lo reemplaza)
GENERALES_ANTERIORES: dict[str, tuple[str, str]] = {
    "texto_no_significativo": ("No aporta cantidades significativas de {nutrientes}.", ""),
}

# Parámetros generales que son sí/no (se guardan como "1" / "0").
GENERALES_BOOLEANOS: tuple[str, ...] = (MOSTRAR_POR_100, FRASE_NO_SIGNIFICATIVO)

# Frase de la declaración nutricional simplificada, con el texto de la Guía de
# Rotulado. Es optativa (se activa con FRASE_NO_SIGNIFICATIVO) pero su texto es
# fijo; `{nutrientes}` se completa con los nutrientes no significativos del
# producto.
TEXTO_NO_SIGNIFICATIVO_FIJO = "No aporta cantidades significativas de {nutrientes}."

# ── Fuentes de los datos ───────────────────────────────────────────────────

FUENTE_BASE = "base_referencia"
FUENTE_PROVEEDOR = "rotulo_proveedor"
FUENTE_BIBLIOGRAFIA = "bibliografia"
FUENTE_PROPIO = "valor_propio"
FUENTES: dict[str, str] = {
    FUENTE_BASE: "Base de composición",
    FUENTE_PROVEEDOR: "Rótulo del proveedor",
    FUENTE_BIBLIOGRAFIA: "Otra bibliografía",
    FUENTE_PROPIO: "Valor propio",
}

# ── Forma de expresar la tabla ─────────────────────────────────────────────

EXPRESAR_G = "g"
EXPRESAR_ML = "ml"

ESTADO_COMPLETA = "completa"
ESTADO_INCOMPLETA = "incompleta"
ESTADO_SIN_RECETA = "sin_receta"

# ── Unidades: conversión a gramos / mililitros ─────────────────────────────

MASA = "masa"
VOLUMEN = "volumen"
POR_UNIDAD = "unidad"

# símbolo o nombre (en minúsculas) -> (tipo, factor a g o ml)
CONVERSIONES: dict[str, tuple[str, Decimal]] = {
    "kg": (MASA, Decimal("1000")),
    "kilogramo": (MASA, Decimal("1000")),
    "g": (MASA, Decimal("1")),
    "gramo": (MASA, Decimal("1")),
    "mg": (MASA, Decimal("0.001")),
    "miligramo": (MASA, Decimal("0.001")),
    "tn": (MASA, Decimal("1000000")),
    "tonelada": (MASA, Decimal("1000000")),
    "l": (VOLUMEN, Decimal("1000")),
    "litro": (VOLUMEN, Decimal("1000")),
    "ml": (VOLUMEN, Decimal("1")),
    "mililitro": (VOLUMEN, Decimal("1")),
    "cm³": (VOLUMEN, Decimal("1")),
    "cm3": (VOLUMEN, Decimal("1")),
    "cc": (VOLUMEN, Decimal("1")),
    "centímetro cúbico": (VOLUMEN, Decimal("1")),
    "un": (POR_UNIDAD, Decimal("1")),
    "unidad": (POR_UNIDAD, Decimal("1")),
}

# ── Base de composición: carga inicial de ejemplo ──────────────────────────
#
# La licencia y el formato de SARA 2 todavía no están verificados (notas de
# alcance), así que no se distribuyen sus datos. Esto es una base mínima de
# EJEMPLO, con valores aproximados por 100 g, para poder probar la pantalla.
# Se reemplaza importando un CSV desde la app.
BASE_EJEMPLO = "Ejemplo (valores aproximados, verificar)"
# (nombre, energía, carbohidratos, azúcares totales, azúcares añadidos,
#  proteínas, grasas totales, saturadas, trans, fibra, sodio mg)
ALIMENTOS_EJEMPLO: tuple[tuple, ...] = (
    ("Harina de trigo 000", 341, 72.0, 0.3, 0, 10.5, 1.2, 0.2, 0, 2.7, 2),
    ("Azúcar blanca", 400, 100.0, 100.0, 0, 0, 0, 0, 0, 0, 0),
    ("Manteca", 717, 0.1, 0.1, 0, 0.9, 81.0, 51.0, 3.3, 0, 11),
    ("Huevo entero crudo", 143, 0.7, 0.4, 0, 12.6, 9.5, 3.1, 0, 0, 142),
    ("Leche entera", 61, 4.8, 4.8, 0, 3.2, 3.3, 1.9, 0.1, 0, 43),
    ("Aceite de girasol", 884, 0, 0, 0, 0, 100.0, 10.3, 0, 0, 0),
    ("Sal fina", 0, 0, 0, 0, 0, 0, 0, 0, 0, 38758),
    ("Levadura fresca", 105, 18.1, 0, 0, 8.4, 1.9, 0.2, 0, 8.1, 30),
    ("Dulce de leche", 315, 55.0, 50.0, 40.0, 6.8, 7.5, 4.6, 0, 0, 120),
    ("Agua", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
)


class ErrorCode:
    INSUMO_NO_ENCONTRADO = "El insumo no fue encontrado."
    PRODUCTO_NO_ENCONTRADO = "El producto no fue encontrado."
    VERSION_NO_ENCONTRADA = "La versión de receta no corresponde a este producto."
    NUTRIENTE_DESCONOCIDO = "Nutriente desconocido."
    NUTRIENTE_REPETIDO = "Un nutriente no puede cargarse dos veces."
    NUTRIENTE_NO_ADMITIDO_ADITIVO = (
        "Un aditivo solo admite valor energético y sodio."
    )
    FUENTE_INVALIDA = "La fuente del dato no es válida."
    ALIMENTO_NO_ENCONTRADO = "El alimento de la base de composición no existe."
    ALIMENTO_SIN_DATO = (
        "El alimento elegido de la base no tiene ese nutriente: cargalo con otra fuente."
    )
    PARAMETRO_DESCONOCIDO = "Parámetro desconocido."
    VD_NO_ADMITIDO = (
        "Los azúcares totales, los azúcares añadidos y las grasas trans no tienen "
        "Valor Diario de referencia en la norma: el %VD se deja en blanco."
    )
    CSV_INVALIDO = "El archivo no es un CSV válido o no tiene la columna 'nombre'."
    BASE_VACIA = "Indicá el nombre de la base de composición."
