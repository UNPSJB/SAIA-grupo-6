class ErrorCode:
    PLAN_CALIBRACION_MANTENIMIENTO_NO_ENCONTRADO = (
        "El plan de calibración y mantenimiento no existe o fue dado de baja."
    )
    EQUIPO_NO_ENCONTRADO = "El equipo indicado no existe."
    EQUIPO_INACTIVO = "El equipo indicado está dado de baja."
    AUTOR_NO_ENCONTRADO = "El autor del plan no existe."
    AUTOR_INACTIVO = "El autor del plan está dado de baja."
    AUTOR_SIN_PERMISO_DE_ADMINISTRAR = (
        "Se requiere permiso de administrar para crear o modificar un plan."
    )
    PLAN_ACTIVO_DUPLICADO = (
        "Ya existe un plan activo de ese tipo para el mismo equipo."
    )
    EQUIPO_ID_INVALIDO = "El equipo indicado no es válido."
