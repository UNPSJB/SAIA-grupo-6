from src.exceptions import NotFound, BadRequest
from src.tareas.constants import ErrorCode


class TareaNoEncontrada(NotFound):
    DETAIL = ErrorCode.TAREA_NO_ENCONTRADA


class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO


class NombreDuplicado(BadRequest):
    DETAIL = ErrorCode.NOMBRE_DUPLICADO


class DatoDuplicado(BadRequest):
    DETAIL = ErrorCode.DATO_DUPLICADO


class PlanLimpiezaIdInvalido(BadRequest):
    DETAIL = ErrorCode.PLAN_LIMPIEZA_ID_INVALIDO


class PlanLimpiezaNoEncontrado(NotFound):
    DETAIL = ErrorCode.PLAN_LIMPIEZA_NO_ENCONTRADO


class FrecuenciaInvalida(BadRequest):
    DETAIL = ErrorCode.FRECUENCIA_INVALIDA
