from fastapi import status

from src.exceptions import BadRequest, DetailedHTTPException, NotFound
from src.planes_accion.constants import ErrorCode


class PlanNoEncontrado(NotFound):
    DETAIL = ErrorCode.PLAN_NO_ENCONTRADO


class SituacionNoEncontrada(NotFound):
    DETAIL = ErrorCode.SITUACION_NO_ENCONTRADA


class AccionNoEncontrada(NotFound):
    DETAIL = ErrorCode.ACCION_NO_ENCONTRADA


class Conflicto(DetailedHTTPException):
    """409: lo pedido choca con el estado actual (p. ej. situación ya en otro plan)."""

    STATUS_CODE = status.HTTP_409_CONFLICT
    DETAIL = "La operación entra en conflicto con el estado actual."


class OperacionNoPermitida(Conflicto):
    DETAIL = ErrorCode.ESTADO_NO_PERMITE


__all__ = ["BadRequest", "Conflicto", "OperacionNoPermitida", "PlanNoEncontrado",
           "SituacionNoEncontrada", "AccionNoEncontrada"]
