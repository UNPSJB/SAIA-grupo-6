from src.exceptions import BadRequest, NotFound
from src.clientes.constants import ErrorCode


class ClienteNoEncontrado(NotFound):
    DETAIL = ErrorCode.CLIENTE_NO_ENCONTRADO


class ClienteYaExiste(BadRequest):
    DETAIL = ErrorCode.DOCUMENTO_YA_EXISTE


class DocumentoInvalido(BadRequest):
    DETAIL = ErrorCode.DOCUMENTO_INVALIDO


class TelefonoVacio(BadRequest):
    DETAIL = ErrorCode.TELEFONO_VACIO


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class EmailInvalido(BadRequest):
    DETAIL = ErrorCode.EMAIL_INVALIDO
