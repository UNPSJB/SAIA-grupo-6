from src.exceptions import NotFound, BadRequest
from src.incidente.constants import ErrorCode


class IncidenteNoEncontrado(NotFound):
    DETAIL = ErrorCode.INCIDENTE_NO_ENCONTRADO


class DescripcionVacia(BadRequest):
    DETAIL = ErrorCode.DESCRIPCION_VACIA


class EquipoNoEncontrado(NotFound):
    """404. Antes era BadRequest (400), a diferencia del mismo nombre en los
    demas módulos."""

    DETAIL = ErrorCode.EQUIPO_NO_ENCONTRADO


class EquipoInactivo(BadRequest):
    DETAIL = ErrorCode.EQUIPO_INACTIVO


class PermisoDenegado(BadRequest):
    """403. Reemplaza al HTTPException crudo que se lanzaba desde el service."""

    STATUS_CODE = 403
    DETAIL = ErrorCode.PERMISO_DENEGADO


class UsuarioNoEncontrado(BadRequest):
    DETAIL = ErrorCode.USUARIO_NO_ENCONTRADO


class UsuarioInactivo(BadRequest):
    DETAIL = ErrorCode.USUARIO_INACTIVO


class EstadoInvalido(BadRequest):
    DETAIL = ErrorCode.ESTADO_INVALIDO
