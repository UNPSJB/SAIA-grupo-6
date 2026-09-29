from fastapi import HTTPException
from src.exceptions import NotFound, BadRequest
from src.unidadMedida.constants import ErrorCode


class UnidadMedidaNoEncontrada(NotFound):
    DETAIL = ErrorCode.UNIDAD_MEDIDA_NO_ENCONTRADA


class UnidadMedidaYaExiste(BadRequest):
    DETAIL = ErrorCode.UNIDAD_MEDIDA_YA_EXISTE


class SimboloYaExiste(BadRequest):
    DETAIL = ErrorCode.SIMBOLO_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO


class SimboloVacio(BadRequest):
    DETAIL = ErrorCode.SIMBOLO_VACIO


class UnidadMedidaEnUso(HTTPException):
    def __init__(self, mensaje: str):
        super().__init__(status_code=400, detail=mensaje)
