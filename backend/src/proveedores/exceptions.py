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
