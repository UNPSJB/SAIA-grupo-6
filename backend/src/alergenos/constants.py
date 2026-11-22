NIVEL_CONTIENE = "contiene"
NIVEL_PUEDE_CONTENER = "puede_contener"
NIVELES = (NIVEL_CONTIENE, NIVEL_PUEDE_CONTENER)

# Carga inicial del catálogo: los alérgenos de declaración obligatoria del CAA
# (art. 235 septies). Es el punto de partida; la lista se mantiene desde la
# app. A verificar con la profesional de referencia.
ALERGENOS_INICIALES = (
    "Cereales con gluten (trigo, avena, cebada, centeno)",
    "Crustáceos",
    "Huevo",
    "Pescado",
    "Maní",
    "Soja",
    "Leche",
    "Frutos secos",
    "Dióxido de azufre y sulfitos",
)


class ErrorCode:
    ALERGENO_NO_ENCONTRADO = "El alérgeno no fue encontrado."
    ALERGENO_YA_EXISTE = "Ya existe un alérgeno con ese nombre."
    NOMBRE_VACIO = "El nombre del alérgeno no puede estar vacío."
    INGREDIENTE_NO_ENCONTRADO = "El ingrediente no fue encontrado."
    ALERGENO_NO_VALIDO = "Uno de los alérgenos no existe o está dado de baja."
    ALERGENO_REPETIDO = "Un alérgeno no puede repetirse en el mismo ingrediente."
    PRODUCTO_NO_ENCONTRADO = "El producto (o la versión de su receta) no fue encontrado."
