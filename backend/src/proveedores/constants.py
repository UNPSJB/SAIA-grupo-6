class ErrorCode:
    PROVEEDOR_NO_ENCONTRADO = "El proveedor no fue encontrado o fue dado de baja."
    MATRICULA_YA_EXISTE = "Ya existe un proveedor registrado con esa matrícula."
    NOMBRE_VACIO = "El nombre del proveedor no puede estar vacío."
    MATRICULA_VACIA = "La matrícula del proveedor no puede estar vacía."
    CUIT_DUPLICADO = "Ya existe un proveedor registrado con ese CUIT."
    CERTIFICACION_NO_ENCONTRADA = "La certificación no fue encontrada."
    CERTIFICACION_INVALIDA = "La certificación no es válida para la fecha de ingreso."

    NOMBRE_DUPLICADO = "Ya existe un proveedor registrado con ese nombre."
    CUIT_INVALIDO = "El CUIT debe contener 11 dígitos numéricos."
    INSUMOS_NO_VALIDOS = "Uno o más insumos no existen o están dados de baja."
