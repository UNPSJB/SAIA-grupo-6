from src.aditivos.constants import ErrorCode
from src.exceptions import BadRequest, NotFound


class ClaseNoEncontrada(NotFound):
    DETAIL = ErrorCode.CLASE_NO_ENCONTRADA


class ClaseYaExiste(BadRequest):
    DETAIL = ErrorCode.CLASE_YA_EXISTE


class ClaseInactiva(BadRequest):
    DETAIL = ErrorCode.CLASE_INACTIVA


class AditivoNoEncontrado(NotFound):
    DETAIL = ErrorCode.ADITIVO_NO_ENCONTRADO


class AditivoYaExiste(BadRequest):
    DETAIL = ErrorCode.ADITIVO_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class InsObligatorio(BadRequest):
    DETAIL = ErrorCode.INS_OBLIGATORIO


class InsInvalido(BadRequest):
    DETAIL = ErrorCode.INS_INVALIDO
