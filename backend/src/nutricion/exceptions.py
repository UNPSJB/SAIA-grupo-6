from src.exceptions import BadRequest, NotFound
from src.nutricion.constants import ErrorCode


class InsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO


class ProductoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class VersionNoEncontrada(NotFound):
    DETAIL = ErrorCode.VERSION_NO_ENCONTRADA


class NutrienteDesconocido(BadRequest):
    DETAIL = ErrorCode.NUTRIENTE_DESCONOCIDO


class NutrienteRepetido(BadRequest):
    DETAIL = ErrorCode.NUTRIENTE_REPETIDO


class NutrienteNoAdmitidoAditivo(BadRequest):
    DETAIL = ErrorCode.NUTRIENTE_NO_ADMITIDO_ADITIVO


class AlimentoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.ALIMENTO_NO_ENCONTRADO


class AlimentoSinDato(BadRequest):
    DETAIL = ErrorCode.ALIMENTO_SIN_DATO


class ParametroDesconocido(BadRequest):
    DETAIL = ErrorCode.PARAMETRO_DESCONOCIDO


class VdNoAdmitido(BadRequest):
    DETAIL = ErrorCode.VD_NO_ADMITIDO


class CsvInvalido(BadRequest):
    DETAIL = ErrorCode.CSV_INVALIDO


class BaseVacia(BadRequest):
    DETAIL = ErrorCode.BASE_VACIA
