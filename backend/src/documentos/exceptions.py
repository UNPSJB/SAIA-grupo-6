from src.documentos.constants import ErrorCode
from src.exceptions import BadRequest, NotFound, PermissionDenied


class DocumentoNoEncontrado(NotFound):
    DETAIL = ErrorCode.DOCUMENTO_NO_ENCONTRADO


class DocumentoYaExiste(BadRequest):
    DETAIL = ErrorCode.DOCUMENTO_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class VersionConcurrente(BadRequest):
    DETAIL = ErrorCode.VERSION_CONCURRENTE


class ArchivoExtensionInvalida(BadRequest):
    DETAIL = ErrorCode.ARCHIVO_EXTENSION_INVALIDA


class ArchivoVacio(BadRequest):
    DETAIL = ErrorCode.ARCHIVO_VACIO


class ArchivoMuyGrande(BadRequest):
    DETAIL = ErrorCode.ARCHIVO_MUY_GRANDE


class UsuarioNoEncontrado(NotFound):
    DETAIL = ErrorCode.USUARIO_NO_ENCONTRADO


class UsuarioInactivo(BadRequest):
    DETAIL = ErrorCode.USUARIO_INACTIVO


class UsuarioSinPermisoDeAdministrar(PermissionDenied):
    DETAIL = ErrorCode.USUARIO_SIN_PERMISO_DE_ADMINISTRAR