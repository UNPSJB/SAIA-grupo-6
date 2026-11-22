from src.exceptions import BadRequest, NotFound
from src.insumos.constants import ErrorCode


class InsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO


class InsumoYaExiste(BadRequest):
    DETAIL = ErrorCode.INSUMO_YA_EXISTE


class MarcaVacia(BadRequest):
    DETAIL = ErrorCode.MARCA_VACIA


class IngredienteNoValido(BadRequest):
    DETAIL = ErrorCode.INGREDIENTE_NO_VALIDO


class ProveedoresNoValidos(BadRequest):
    DETAIL = ErrorCode.PROVEEDORES_NO_VALIDOS


class NutrienteNoAdmitido(BadRequest):
    DETAIL = ErrorCode.NUTRIENTE_NO_ADMITIDO


class NutrienteRepetido(BadRequest):
    DETAIL = ErrorCode.NUTRIENTE_REPETIDO


class AlergenoRepetido(BadRequest):
    DETAIL = ErrorCode.ALERGENO_REPETIDO


class AlergenoNoValido(BadRequest):
    DETAIL = ErrorCode.ALERGENO_NO_VALIDO


class AlergenosNoCumplen(BadRequest):
    DETAIL = ErrorCode.ALERGENOS_NO_CUMPLEN


class JustificacionRequerida(BadRequest):
    DETAIL = ErrorCode.JUSTIFICACION_REQUERIDA
