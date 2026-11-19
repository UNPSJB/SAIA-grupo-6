from src.exceptions import BadRequest, NotFound
from src.salidas.constants import ErrorCode


class LoteNoEncontrado(NotFound):
    DETAIL = ErrorCode.LOTE_NO_ENCONTRADO


class LoteRetirado(BadRequest):
    DETAIL = ErrorCode.LOTE_RETIRADO


class ClienteNoEncontrado(NotFound):
    DETAIL = ErrorCode.CLIENTE_NO_ENCONTRADO


class ClienteInactivo(BadRequest):
    DETAIL = ErrorCode.CLIENTE_INACTIVO


class CantidadInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_INVALIDA


class CantidadNoEntera(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_NO_ENTERA


class SaldoInsuficiente(BadRequest):
    DETAIL = ErrorCode.SALDO_INSUFICIENTE


class FechaAnteriorAElaboracion(BadRequest):
    DETAIL = ErrorCode.FECHA_ANTERIOR_A_ELABORACION


class HitoLoteNoEncontrado(NotFound):
    DETAIL = ErrorCode.HITO_NO_ENCONTRADO


class SalidaNoEncontrada(NotFound):
    DETAIL = ErrorCode.SALIDA_NO_ENCONTRADA


class TransicionInvalida(BadRequest):
    DETAIL = ErrorCode.TRANSICION_INVALIDA


class TransportistaRequerido(BadRequest):
    DETAIL = ErrorCode.TRANSPORTISTA_REQUERIDO


class TransportistaNoPermitido(BadRequest):
    DETAIL = ErrorCode.TRANSPORTISTA_NO_PERMITIDO


class TransportistaNoEncontrado(NotFound):
    DETAIL = ErrorCode.TRANSPORTISTA_NO_ENCONTRADO


class TransportistaInactivo(BadRequest):
    DETAIL = ErrorCode.TRANSPORTISTA_INACTIVO


class TransportistaNoHabilitado(BadRequest):
    DETAIL = ErrorCode.TRANSPORTISTA_NO_HABILITADO


class FechaInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_INVALIDA


class MotivoRequerido(BadRequest):
    DETAIL = ErrorCode.MOTIVO_REQUERIDO


class LoteVencidoError(BadRequest):
    DETAIL = ErrorCode.LOTE_VENCIDO


class FechaReservaFutura(BadRequest):
    DETAIL = ErrorCode.FECHA_RESERVA_FUTURA


class MotivoRechazoInvalido(BadRequest):
    DETAIL = ErrorCode.MOTIVO_RECHAZO_INVALIDO


class DetalleRechazoRequerido(BadRequest):
    DETAIL = ErrorCode.DETALLE_RECHAZO_REQUERIDO


class DetalleRechazoDemasiadoLargo(BadRequest):
    DETAIL = ErrorCode.DETALLE_RECHAZO_DEMASIADO_LARGO


class FechaRechazoInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_RECHAZO_INVALIDA


class DisposicionInvalida(BadRequest):
    DETAIL = ErrorCode.DISPOSICION_INVALIDA


class RechazoYaResuelto(BadRequest):
    DETAIL = ErrorCode.RECHAZO_YA_RESUELTO


class JustificacionRequerida(BadRequest):
    DETAIL = ErrorCode.JUSTIFICACION_REQUERIDA


class JustificacionDemasiadoLarga(BadRequest):
    DETAIL = ErrorCode.JUSTIFICACION_DEMASIADO_LARGA


class ReingresoNoPermitidoLoteVencido(BadRequest):
    DETAIL = ErrorCode.REINGRESO_LOTE_VENCIDO


class ReingresoNoPermitidoLoteRetirado(BadRequest):
    DETAIL = ErrorCode.REINGRESO_LOTE_RETIRADO
