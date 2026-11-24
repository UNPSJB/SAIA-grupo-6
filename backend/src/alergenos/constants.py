NIVEL_CONTIENE = "contiene"
NIVEL_PUEDE_CONTENER = "puede_contener"

# Cómo está evaluado un ingrediente: sin evaluar o incompleta deja la
# declaración del rótulo pendiente (no se asume "sin alérgenos").
EVALUACION_SIN_EVALUAR = "sin_evaluar"
EVALUACION_INCOMPLETA = "incompleta"
EVALUACION_EVALUADA = "evaluada"

# El gluten va aparte de los cereales: una ausencia declarada es un dato del
# ingrediente, no autoriza a rotular el producto como libre de gluten.
GLUTEN_DESCONOCIDO = "desconocido"
GLUTEN_PRESENTE = "presente"
GLUTEN_AUSENCIA_DECLARADA = "ausencia_declarada"

# Versión de las reglas con que se arman las declaraciones (queda en cada
# revisión del rótulo).
VERSION_REGLAS = "caa-235-septimo-2025-06-v1"

# Carga inicial del catálogo: (código, nombre, condicionada). Art. 235
# séptimo del CAA y orientación de ANMAT:
# https://www.argentina.gob.ar/anmat/regulados/alimentos/alergenos-alimentarios/elaboradores-de-alimentos
# Es el punto de partida; la lista se mantiene desde la app.
ALERGENOS_INICIALES = (
    ("trigo", "Trigo", False),
    ("centeno", "Centeno", False),
    ("cebada", "Cebada", False),
    ("avena", "Avena", False),
    ("crustaceos", "Crustáceos", False),
    ("huevo", "Huevo", False),
    ("pescado", "Pescado", False),
    ("mani", "Maní", False),
    ("soja", "Soja", False),
    ("leche", "Leche", False),
    ("almendra", "Almendra", False),
    ("avellana", "Avellana", False),
    ("castana", "Castaña", False),
    ("castana_caju", "Castaña de cajú", False),
    ("nuez_brasil", "Nuez de Brasil", False),
    ("nuez", "Nuez", False),
    ("pecan", "Pecán", False),
    ("pistacho", "Pistacho", False),
    ("sulfitos", "Dióxido de azufre y sulfitos", True),
)


class ErrorCode:
    ALERGENO_NO_ENCONTRADO = "El alérgeno no fue encontrado."
    ALERGENO_YA_EXISTE = "Ya existe un alérgeno con ese nombre."
    NOMBRE_VACIO = "El nombre del alérgeno no puede estar vacío."
    INGREDIENTE_NO_ENCONTRADO = "El ingrediente no fue encontrado."
    ALERGENO_NO_VALIDO = "Uno de los alérgenos no existe o está dado de baja."
    ALERGENO_REPETIDO = "Un alérgeno no puede repetirse en el mismo ingrediente."
    DERIVADO_SOLO_CONTIENE = (
        "Solo lo que el ingrediente contiene puede declararse como derivado."
    )
    PRODUCTO_NO_ENCONTRADO = "El producto (o la versión de su receta) no fue encontrado."
