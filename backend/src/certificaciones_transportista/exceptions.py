from src.exceptions import BadRequest, NotFound
from src.certificaciones_transportista.constants import ErrorCode


class CertificacionTransportistaNoEncontrada(NotFound):
    DETAIL = ErrorCode.CERTIFICACION_NO_ENCONTRADA


class TransportistaNoEncontrado(NotFound):
    DETAIL = ErrorCode.TRANSPORTISTA_NO_ENCONTRADO


class ArchivoInvalido(BadRequest):
    DETAIL = ErrorCode.ARCHIVO_INVALIDO


class ArchivoDemasiadoGrande(BadRequest):
    DETAIL = ErrorCode.ARCHIVO_DEMASIADO_GRANDE


class FechaVencimientoInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_VENCIMIENTO_INVALIDA


class TipoVacio(BadRequest):
    DETAIL = ErrorCode.TIPO_VACIO


class NumeroVacio(BadRequest):
    DETAIL = ErrorCode.NUMERO_VACIO


class MotivoAnulacionRequerido(BadRequest):
    DETAIL = ErrorCode.MOTIVO_ANULACION_REQUERIDO


class CertificacionYaAnulada(BadRequest):
    DETAIL = ErrorCode.CERTIFICACION_YA_ANULADA


class CertificacionInmutable(BadRequest):
    DETAIL = ErrorCode.CERTIFICACION_INMUTABLE


class CertificacionYaActiva(BadRequest):
    DETAIL = ErrorCode.CERTIFICACION_YA_ACTIVA
