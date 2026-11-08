from src.exceptions import BadRequest, NotFound
from src.productos.constants import ErrorCode


class ProductoNoEncontrado(NotFound):
    DETAIL = ErrorCode.PRODUCTO_NO_ENCONTRADO


class ProductoYaExiste(BadRequest):
    DETAIL = ErrorCode.PRODUCTO_YA_EXISTE


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class UnidadMedidaNoExiste(BadRequest):
    DETAIL = ErrorCode.UNIDAD_NO_EXISTE


class UnidadMedidaInactiva(BadRequest):
    DETAIL = ErrorCode.UNIDAD_INACTIVA
