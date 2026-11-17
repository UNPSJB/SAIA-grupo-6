from src.exceptions import BadRequest, NotFound
from src.proveedores.constants import ErrorCode


class ProveedorNoEncontrado(NotFound):
    DETAIL = ErrorCode.PROVEEDOR_NO_ENCONTRADO


class MatriculaYaExiste(BadRequest):
    DETAIL = ErrorCode.MATRICULA_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class MatriculaVacia(BadRequest):
    DETAIL = ErrorCode.MATRICULA_VACIA

class CuitDuplicado(BadRequest):
    DETAIL = ErrorCode.CUIT_DUPLICADO

class CertificacionNoEncontrada(NotFound):
    DETAIL = ErrorCode.CERTIFICACION_NO_ENCONTRADA

class CertificacionInvalida(BadRequest):
    DETAIL = ErrorCode.CERTIFICACION_INVALIDA


class NombreProveedorDuplicado(BadRequest):
    DETAIL = ErrorCode.NOMBRE_DUPLICADO


class CuitInvalido(BadRequest):
    DETAIL = ErrorCode.CUIT_INVALIDO

class InsumosNoValidos(BadRequest):
    DETAIL = ErrorCode.INSUMOS_NO_VALIDOS
