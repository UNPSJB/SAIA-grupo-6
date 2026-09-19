from enum import Enum


class ErrorCode(str, Enum):
    TAREA_NO_ENCONTRADA = "tarea_no_encontrada"
    NOMBRE_INVALIDO = "nombre_invalido"
    NOMBRE_DUPLICADO = "nombre_duplicado"
    DATO_DUPLICADO = "dato_duplicado"
