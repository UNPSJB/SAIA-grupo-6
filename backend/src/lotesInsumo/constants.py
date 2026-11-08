class ErrorCode:
    LOTE_NO_ENCONTRADO = "El lote de insumo no fue encontrado."
    INSUMO_NO_ENCONTRADO = "El insumo no existe o está dado de baja."
    PROVEEDOR_NO_ENCONTRADO = "El proveedor no existe o fue dado de baja."
    LOTE_YA_EXISTE = (
        "Ya existe un lote de ese insumo con ese número para ese proveedor."
    )
    NUMERO_VACIO = "El número de lote del proveedor no puede estar vacío."
    MOTIVO_VACIO = "El motivo de la baja no puede estar vacío."
    LOTE_YA_DADO_DE_BAJA = "El lote de insumo ya fue dado de baja."
    VENCIMIENTO_ANTERIOR = (
        "La fecha de vencimiento no puede ser anterior a la fecha de ingreso."
    )
