from src.exceptions import BadRequest, NotFound

from src.consumoInsumoQuimico.constants import ErrorCode


class ConsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.CONSUMO_NO_ENCONTRADO


class CantidadInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_INVALIDA


class InsumoQuimicoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_QUIMICO_NO_ENCONTRADO


class InsumoQuimicoInactivo(BadRequest):
    DETAIL = ErrorCode.INSUMO_QUIMICO_INACTIVO


class RegistroTareaNoEncontrado(NotFound):
    DETAIL = ErrorCode.REGISTRO_TAREA_NO_ENCONTRADO


class StockInsuficiente(BadRequest):
    DETAIL = ErrorCode.STOCK_INSUFICIENTE