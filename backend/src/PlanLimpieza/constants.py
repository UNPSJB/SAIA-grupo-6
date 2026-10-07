class ErrorCode:
    PLAN_LIMPIEZA_NO_ENCONTRADO = "El plan de limpieza no existe o fue dado de baja."
    DATO_DUPLICADO = "Ya existe un registro activo con esos datos."
    AUTOR_NO_ENCONTRADO = "El autor del plan no existe."
    AUTOR_INACTIVO = "El autor del plan está dado de baja."
    AUTOR_SIN_PERMISO_DE_ADMINISTRAR = (
        "Se requiere permiso de administrar para crear o modificar un plan."
    )
    NOMBRE_PLAN_DUPLICADO = "Ya existe un plan de limpieza con ese nombre."
    NOMBRE_INVALIDO = (
        "El nombre del plan no puede estar vacío y debe contener solo letras."
    )
    TAREAS_VACIAS = "El plan de limpieza debe tener al menos una tarea."
    EQUIPO_ID_INVALIDO = "El equipo indicado no es válido."
    AUTOR_ID_INVALIDO = "El autor indicado no es válido."
