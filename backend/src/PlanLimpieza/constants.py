from enum import Enum


class ErrorCode(str, Enum):
    PLAN_LIMPIEZA_NO_ENCONTRADO = "plan_limpieza_no_encontrado"
    DATO_DUPLICADO = "dato_duplicado"
    AUTOR_NO_ENCONTRADO = "autor_no_encontrado"
    AUTOR_INACTIVO = "autor_inactivo"
    AUTOR_SIN_PERMISO_DE_ADMINISTRAR = "autor_sin_permiso_de_administrar"
    NOMBRE_PLAN_DUPLICADO = "nombre_plan_duplicado"
    NOMBRE_INVALIDO = "nombre_invalido"
    FRECUENCIA_INVALIDA = "frecuencia_invalida"
    TAREAS_VACIAS = "tareas_vacias"
    EQUIPO_ID_INVALIDO = "equipo_id_invalido"
    AUTOR_ID_INVALIDO = "autor_id_invalido"
