class ErrorCode:
    PERSONA_NO_ENCONTRADA = "La persona asociada no existe o fue dada de baja."
    APTITUD_NO_ENCONTRADA = "La aptitud asociada no existe o fue dada de baja."
    VENCIMIENTO_NO_ENCONTRADO = "El vencimiento solicitado no existe."
    APTITUD_DUPLICADA = (
        "Ya existe un vencimiento cargado para esta persona con esa aptitud. "
        "Edite la fecha existente para renovarlo."
    )
    FECHA_VENCIMIENTO_PASADA = "La fecha de vencimiento no puede ser anterior a hoy."