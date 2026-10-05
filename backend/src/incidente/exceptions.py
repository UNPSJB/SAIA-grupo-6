from src.exceptions import NotFound, BadRequest
from src.incidente.constants import ErrorCode


class IncidenteNoEncontrado(NotFound):
    DETAIL = ErrorCode.INCIDENTE_NO_ENCONTRADO


class DescripcionVacia(BadRequest):
    DETAIL = ErrorCode.DESCRIPCION_VACIA


class TipoInvalido(BadRequest):
    DETAIL = ErrorCode.TIPO_INVALIDO


class EquipoNoEncontrado(BadRequest):
    DETAIL = ErrorCode.EQUIPO_NO_ENCONTRADO


class UsuarioNoEncontrado(BadRequest):
    DETAIL = ErrorCode.USUARIO_NO_ENCONTRADO


class UsuarioInactivo(BadRequest):
    DETAIL = ErrorCode.USUARIO_INACTIVO


class EstadoInvalido(BadRequest):
    DETAIL = ErrorCode.ESTADO_INVALIDO
