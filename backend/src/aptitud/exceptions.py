from fastapi import HTTPException
from src.exceptions import NotFound, BadRequest
from src.aptitud.constants import ErrorCode


class AptitudNoEncontrada(NotFound):
    DETAIL = ErrorCode.APTITUD_NO_ENCONTRADA


class AptitudYaExiste(BadRequest):
    DETAIL = ErrorCode.APTITUD_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO


class AptitudEnUso(HTTPException):
    def __init__(self, mensaje: str):
        super().__init__(status_code=400, detail=mensaje)