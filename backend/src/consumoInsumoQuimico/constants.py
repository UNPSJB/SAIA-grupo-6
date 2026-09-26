from enum import Enum


class ErrorCode(str, Enum):
    CONSUMO_NO_ENCONTRADO = "consumo_no_encontrado"
    CANTIDAD_INVALIDA = "cantidad_invalida"
    INSUMO_QUIMICO_NO_ENCONTRADO = "insumo_quimico_no_encontrado"
    INSUMO_QUIMICO_INACTIVO = "insumo_quimico_inactivo"
    REGISTRO_TAREA_NO_ENCONTRADO = "registro_tarea_no_encontrado"
    STOCK_INSUFICIENTE = "stock_insuficiente"