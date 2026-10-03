from src.exceptions import NotFound, BadRequest
from src.vencimientoPersonal.constants import ErrorCode


class PersonaNoEncontrada(NotFound):
    DETAIL = ErrorCode.PERSONA_NO_ENCONTRADA


class AptitudNoEncontrada(NotFound):
    DETAIL = ErrorCode.APTITUD_NO_ENCONTRADA


class VencimientoNoEncontrado(NotFound):
    DETAIL = ErrorCode.VENCIMIENTO_NO_ENCONTRADO


class AptitudDuplicada(BadRequest):
    DETAIL = ErrorCode.APTITUD_DUPLICADA

class FechaVencimientoPasada(BadRequest):
    DETAIL = ErrorCode.FECHA_VENCIMIENTO_PASADA