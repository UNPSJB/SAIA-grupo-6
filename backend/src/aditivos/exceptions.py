from src.aditivos.constants import ErrorCode
from src.exceptions import BadRequest, NotFound


class ClaseNoEncontrada(NotFound):
    DETAIL = ErrorCode.CLASE_NO_ENCONTRADA


class ClaseYaExiste(BadRequest):
    DETAIL = ErrorCode.CLASE_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class InsObligatorio(BadRequest):
    DETAIL = ErrorCode.INS_OBLIGATORIO


class InsInvalido(BadRequest):
    DETAIL = ErrorCode.INS_INVALIDO
