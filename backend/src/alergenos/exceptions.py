from src.alergenos.constants import ErrorCode
from src.exceptions import BadRequest, NotFound


class AlergenoNoEncontrado(NotFound):
    DETAIL = ErrorCode.ALERGENO_NO_ENCONTRADO


class AlergenoYaExiste(BadRequest):
    DETAIL = ErrorCode.ALERGENO_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class IngredienteNoEncontrado(NotFound):
    DETAIL = ErrorCode.INGREDIENTE_NO_ENCONTRADO


class AlergenoNoValido(BadRequest):
    DETAIL = ErrorCode.ALERGENO_NO_VALIDO


class AlergenoRepetido(BadRequest):
    DETAIL = ErrorCode.ALERGENO_REPETIDO


class ProductoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class DerivadoSoloContiene(BadRequest):
    DETAIL = ErrorCode.DERIVADO_SOLO_CONTIENE
