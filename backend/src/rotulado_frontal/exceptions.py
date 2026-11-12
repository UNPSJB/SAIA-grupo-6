from src.exceptions import BadRequest, NotFound


class ErrorCode:
    PRODUCTO_NO_ENCONTRADO = "El producto no existe."
    REGLA_NO_ENCONTRADA = "La versión de la regla no existe."
    SIN_REGLA_VIGENTE = (
        "No hay una regla de rotulado frontal vigente. Activá una versión antes "
        "de evaluar un producto."
    )
    VERSION_NO_ENCONTRADA = "La versión de receta indicada no existe o no pertenece al producto."


class ProductoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class ReglaNoEncontrada(NotFound):
    DETAIL = ErrorCode.REGLA_NO_ENCONTRADA


class SinReglaVigente(BadRequest):
    DETAIL = ErrorCode.SIN_REGLA_VIGENTE


class VersionNoEncontrada(NotFound):
    DETAIL = ErrorCode.VERSION_NO_ENCONTRADA
