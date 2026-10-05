from enum import Enum


class ErrorCode(str, Enum):
    PLAN_CALIBRACION_MANTENIMIENTO_NO_ENCONTRADO = (
        "plan_calibracion_mantenimiento_no_encontrado"
    )
    EQUIPO_NO_ENCONTRADO = "equipo_no_encontrado"
    EQUIPO_INACTIVO = "equipo_inactivo"
    AUTOR_NO_ENCONTRADO = "autor_no_encontrado"
    AUTOR_INACTIVO = "autor_inactivo"
    AUTOR_SIN_PERMISO_DE_ADMINISTRAR = "autor_sin_permiso_de_administrar"
    PLAN_ACTIVO_DUPLICADO = "plan_activo_duplicado"
    EQUIPO_ID_INVALIDO = "equipo_id_invalido"
    AUTOR_ID_INVALIDO = "autor_id_invalido"
