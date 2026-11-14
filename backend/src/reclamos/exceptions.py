from src.exceptions import BadRequest, NotFound
from src.reclamos.constants import ErrorCode


class ReclamoNoEncontrado(NotFound):
    DETAIL = ErrorCode.RECLAMO_NO_ENCONTRADO


class ReclamoSalidaNoEntregada(BadRequest):
    DETAIL = ErrorCode.SALIDA_NO_ENTREGADA


class ReclamoFechaInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_INVALIDA


class ReclamoMotivoInvalido(BadRequest):
    DETAIL = ErrorCode.MOTIVO_INVALIDO


class ReclamoDetalleRequerido(BadRequest):
    DETAIL = ErrorCode.DETALLE_REQUERIDO


class ReclamoDetalleDemasiadoLargo(BadRequest):
    DETAIL = ErrorCode.DETALLE_DEMASIADO_LARGO
