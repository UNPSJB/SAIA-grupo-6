TIPO_MASA = "masa"
TIPO_VOLUMEN = "volumen"
TIPO_UNIDAD = "unidad"
TIPOS = (TIPO_MASA, TIPO_VOLUMEN, TIPO_UNIDAD)

# Equivalencias de las unidades de uso común. La base de masa es el gramo y la
# de volumen el mililitro: es lo que esperan la composición porcentual y la
# tabla nutricional.
#
# Solo sirven para INICIALIZAR el tipo y el factor de una unidad (migración y
# seeds). En la app, la fuente de verdad es `UnidadMedida.tipo` /
# `factor_a_base`, que se editan desde la pantalla de unidades.
#
# Las que no son de masa ni de volumen (metro, hora...) no figuran: quedan con
# el default (tipo "unidad", factor 1).
EQUIVALENCIAS_POR_NOMBRE: dict[str, tuple[str, float]] = {
    "tonelada": (TIPO_MASA, 1_000_000),
    "kilogramo": (TIPO_MASA, 1000),
    "gramo": (TIPO_MASA, 1),
    "miligramo": (TIPO_MASA, 0.001),
    "litro": (TIPO_VOLUMEN, 1000),
    "mililitro": (TIPO_VOLUMEN, 1),
    "centimetro cubico": (TIPO_VOLUMEN, 1),
    "unidad": (TIPO_UNIDAD, 1),
    "docena": (TIPO_UNIDAD, 12),
}

# Por si el nombre no se reconoce ("Kilos", "Lts."): el símbolo.
EQUIVALENCIAS_POR_SIMBOLO: dict[str, tuple[str, float]] = {
    "t": EQUIVALENCIAS_POR_NOMBRE["tonelada"],
    "tn": EQUIVALENCIAS_POR_NOMBRE["tonelada"],
    "kg": EQUIVALENCIAS_POR_NOMBRE["kilogramo"],
    "g": EQUIVALENCIAS_POR_NOMBRE["gramo"],
    "gr": EQUIVALENCIAS_POR_NOMBRE["gramo"],
    "mg": EQUIVALENCIAS_POR_NOMBRE["miligramo"],
    "mgr": EQUIVALENCIAS_POR_NOMBRE["miligramo"],
    "l": EQUIVALENCIAS_POR_NOMBRE["litro"],
    "lt": EQUIVALENCIAS_POR_NOMBRE["litro"],
    "ml": EQUIVALENCIAS_POR_NOMBRE["mililitro"],
    "cc": EQUIVALENCIAS_POR_NOMBRE["centimetro cubico"],
    "cm3": EQUIVALENCIAS_POR_NOMBRE["centimetro cubico"],
    "u": EQUIVALENCIAS_POR_NOMBRE["unidad"],
    "un": EQUIVALENCIAS_POR_NOMBRE["unidad"],
    "doc": EQUIVALENCIAS_POR_NOMBRE["docena"],
    "dz": EQUIVALENCIAS_POR_NOMBRE["docena"],
}


def _normalizar(texto: str) -> str:
    from unicodedata import combining, normalize

    texto = texto.replace("³", "3")
    sin_tildes = "".join(c for c in normalize("NFD", texto) if not combining(c))
    return " ".join(sin_tildes.lower().strip(" .").split())


def equivalencia_conocida(nombre: str, simbolo: str | None = None) -> dict | None:
    """`{"tipo", "factor_a_base"}` de una unidad conocida (por nombre o símbolo), o None."""
    encontrada = EQUIVALENCIAS_POR_NOMBRE.get(_normalizar(nombre))
    if encontrada is None and simbolo:
        encontrada = EQUIVALENCIAS_POR_SIMBOLO.get(_normalizar(simbolo))
    if encontrada is None:
        return None
    tipo, factor = encontrada
    return {"tipo": tipo, "factor_a_base": factor}



class ErrorCode:
    UNIDAD_MEDIDA_NO_ENCONTRADA = "La unidad de medida no fue encontrada o fue dada de baja."
    DATO_DUPLICADO = "Ya existe un registro activo con esos datos en el sistema."
    UNIDAD_MEDIDA_YA_EXISTE = "Ya existe una unidad de medida registrada con ese nombre."
    SIMBOLO_YA_EXISTE = "Ya existe una unidad de medida registrada con ese símbolo."
    NOMBRE_VACIO = "El nombre de la unidad de medida no puede estar vacío."
    NOMBRE_INVALIDO = "El nombre de la unidad de medida debe contener letras o números válidos."
    SIMBOLO_VACIO = "El símbolo de la unidad de medida no puede estar vacío."
    FACTOR_INVALIDO = "El factor a base debe ser mayor a cero."
    UNIDAD_MEDIDA_EN_USO = "La unidad de medida está en uso y no puede ser eliminada."
