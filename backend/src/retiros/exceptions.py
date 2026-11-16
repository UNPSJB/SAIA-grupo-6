from src.exceptions import BadRequest, NotFound
from src.retiros.constants import ErrorCode


class LoteYaRetirado(BadRequest):
    DETAIL = ErrorCode.LOTE_YA_RETIRO


class RetiroNoEncontrado(NotFound):
    DETAIL = ErrorCode.RETIRO_NO_ENCONTRADO


class RetiroFechaInvalida(BadRequest):
    DETAIL = ErrorCode.RETIRO_FECHA_INVALIDA


class RetiroMotivoInvalido(BadRequest):
    DETAIL = ErrorCode.RETIRO_MOTIVO_INVALIDO


class MedioContactoInvalido(BadRequest):
    DETAIL = ErrorCode.MEDIO_CONTACTO_INVALIDO


class RetiroYaCerrado(BadRequest):
    DETAIL = ErrorCode.RETIRO_YA_CERRADO


class AfectadoYaNotificado(BadRequest):
    DETAIL = ErrorCode.AFECTADO_YA_NOTIFICADO


class AfectadosPendientes(BadRequest):
    DETAIL = ErrorCode.AFECTADOS_PENDIENTES


class ReclamoNoCorrespondeAlLote(BadRequest):
    DETAIL = ErrorCode.RECLAMO_NO_CORRESPONDE_AL_LOTE
