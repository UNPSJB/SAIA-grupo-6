from src.exceptions import BadRequest, NotFound
from src.transportistas.constants import ErrorCode


class TransportistaNoEncontrado(NotFound):
    DETAIL = ErrorCode.TRANSPORTISTA_NO_ENCONTRADO


class TransportistaYaExiste(BadRequest):
    DETAIL = ErrorCode.CUIT_YA_EXISTE


class CuitInvalido(BadRequest):
    DETAIL = ErrorCode.CUIT_INVALIDO


class TelefonoVacio(BadRequest):
    DETAIL = ErrorCode.TELEFONO_VACIO


class RazonSocialVacia(BadRequest):
    DETAIL = ErrorCode.RAZON_SOCIAL_VACIA


class EmailInvalido(BadRequest):
    DETAIL = ErrorCode.EMAIL_INVALIDO
