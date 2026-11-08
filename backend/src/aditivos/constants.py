import re

# INS (Sistema Internacional de Numeración del Codex): 3 o 4 dígitos, una letra
# opcional y un subíndice romano opcional. Ej.: 202, 160a, 150d, 500(ii), 1422.
RE_NUMERO_INS = re.compile(r"^\d{3,4}[a-z]?(\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\))?$")


class ErrorCode:
    CLASE_NO_ENCONTRADA = "La clase funcional no fue encontrada."
    CLASE_YA_EXISTE = "Ya existe una clase funcional con ese nombre."
    CLASE_INACTIVA = "La clase funcional está dada de baja."
    ADITIVO_NO_ENCONTRADO = "El aditivo no fue encontrado."
    ADITIVO_YA_EXISTE = "Ya existe un aditivo con ese nombre en esa clase funcional."
    NOMBRE_VACIO = "El nombre no puede estar vacío."
    INS_OBLIGATORIO = (
        "El número INS es obligatorio para esta clase funcional "
        "(solo es opcional para los aromatizantes)."
    )
    INS_INVALIDO = (
        "El número INS no es válido. Usá el formato del Codex, por ejemplo "
        "202, 160a o 500(ii)."
    )
