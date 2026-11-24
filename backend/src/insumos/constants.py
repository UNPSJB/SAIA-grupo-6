class ErrorCode:
    INSUMO_NO_ENCONTRADO = "El insumo no fue encontrado."
    INSUMO_YA_EXISTE = "Ese ingrediente ya tiene un insumo con esa marca y descripción."
    MARCA_VACIA = "La marca no puede estar vacía."
    INGREDIENTE_NO_VALIDO = "El ingrediente no existe o está dado de baja."
    PROVEEDORES_NO_VALIDOS = "Uno o más proveedores no existen o están dados de baja."
    NUTRIENTE_NO_ADMITIDO = "Ese nutriente no corresponde a este insumo (a un aditivo solo se le cargan energía y sodio)."
    NUTRIENTE_REPETIDO = "Un nutriente no puede repetirse en el rótulo."
    ALERGENO_REPETIDO = "Un alérgeno no puede repetirse en el rótulo."
    ALERGENO_NO_VALIDO = "Uno de los alérgenos no existe o está dado de baja."
    ALERGENOS_NO_CUMPLEN = (
        "No se puede aprobar: el rótulo declara alérgenos que el ingrediente no admite. "
        "Si la marca es correcta, corresponde a otro ingrediente (por ejemplo, uno que declare ese alérgeno)."
    )
    JUSTIFICACION_REQUERIDA = (
        "La comparación tiene observaciones: para aprobar el insumo indicá la justificación."
    )
