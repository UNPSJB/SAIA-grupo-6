from src.exceptions import BadRequest
from src.paneles.constants import ErrorCode


class RangoFechasInvalido(BadRequest):
    DETAIL = ErrorCode.RANGO_INVALIDO


class PeriodoDemasiadoLargo(BadRequest):
    DETAIL = ErrorCode.PERIODO_DEMASIADO_LARGO
