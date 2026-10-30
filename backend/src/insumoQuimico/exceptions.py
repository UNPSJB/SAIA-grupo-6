from src.exceptions import BadRequest, DetailedHTTPException, NotFound
from src.insumoQuimico.constants import ErrorCode 

class InsumoQuimicoNoEncontrado(NotFound): 
    DETAIL = ErrorCode.INSUMO_QUIMICO_NO_ENCONTRADO 
class DatoDuplicado(BadRequest):
    DETAIL = ErrorCode.DATO_DUPLICADO


class InsumoQuimicoYaExiste(BadRequest): 
    DETAIL = ErrorCode.INSUMO_QUIMICO_YA_EXISTE 
class NombreVacio(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_VACIO 
class NombreInvalido(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_INVALIDO

class UnidadMedidaNoExiste(BadRequest):
    DETAIL = "La unidad de medida seleccionada no existe."

class UnidadMedidaInactiva(BadRequest):
    DETAIL = "La unidad de medida seleccionada está inactiva."


class StockInsuficiente(DetailedHTTPException):
    STATUS_CODE = 409
    DETAIL = ErrorCode.STOCK_INSUFICIENTE


class CantidadStockInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_STOCK_INVALIDA


class MotivoAjusteRequerido(BadRequest):
    DETAIL = ErrorCode.MOTIVO_AJUSTE_REQUERIDO


class UnidadConMovimientos(BadRequest):
    DETAIL = ErrorCode.UNIDAD_CON_MOVIMIENTOS


class ProveedorIngresoInvalido(BadRequest):
    DETAIL = ErrorCode.PROVEEDOR_INGRESO_INVALIDO


class NumeroLoteRequerido(BadRequest):
    DETAIL = ErrorCode.NUMERO_LOTE_REQUERIDO
