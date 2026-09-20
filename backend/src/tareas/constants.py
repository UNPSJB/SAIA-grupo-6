from enum import Enum


class ErrorCode(str, Enum):
    TAREA_NO_ENCONTRADA = "tarea_no_encontrada"
    NOMBRE_INVALIDO = "nombre_invalido"
    NOMBRE_DUPLICADO = "nombre_duplicado"
    DATO_DUPLICADO = "dato_duplicado"
    PLAN_LIMPIEZA_ID_INVALIDO = "plan_limpieza_id_invalido"
    PLAN_LIMPIEZA_NO_ENCONTRADO = "plan_limpieza_no_encontrado"
