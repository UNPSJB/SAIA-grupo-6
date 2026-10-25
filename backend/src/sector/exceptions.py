from fastapi import HTTPException
from src.exceptions import NotFound, BadRequest
from src.sector.constants import ErrorCode


class SectorNoEncontrado(NotFound):
    DETAIL = ErrorCode.SECTOR_NO_ENCONTRADO


class SectorYaExiste(BadRequest):
    DETAIL = ErrorCode.SECTOR_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO


class SectorEnUso(HTTPException):
    def __init__(self, mensaje: str):
        super().__init__(status_code=400, detail=mensaje)