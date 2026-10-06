class ErrorCode:
    FECHA_INVALIDA = "La fecha indicada no es válida."
    EQUIPO_ID_INVALIDO = "El equipo indicado no es válido."
    CHECKLIST_INMUTABLE = (
        "El checklist corresponde a un día anterior y ya no admite "
        "modificaciones."
    )
    CHECKLIST_FUTURO = (
        "El checklist de una fecha futura es solo una previsualización: "
        "todavía no hay nada que marcar."
    )
    CANTIDAD_CONSUMIDA_INVALIDA = "La cantidad consumida debe ser mayor a cero."
    INSUMO_QUIMICO_NO_ENCONTRADO = (
        "El insumo químico seleccionado no existe o fue dado de baja."
    )
    ELEMENTO_LIMPIEZA_NO_ENCONTRADO = (
        "El elemento de limpieza seleccionado no existe o fue dado de baja."
    )
    REGISTRO_TAREA_NO_ENCONTRADO = "El registro de la tarea no existe."
