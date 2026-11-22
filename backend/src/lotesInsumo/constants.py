MOTIVOS_BAJA_INSUMO = (
    "danado",
    "vencido",
    "contaminado",
    "devuelto_proveedor",
)

ETIQUETAS_MOTIVO_BAJA = {
    "danado": "Dañado",
    "vencido": "Vencido",
    "contaminado": "Contaminado",
    "devuelto_proveedor": "Devuelto al proveedor",
}


class ErrorCode:
    LOTE_NO_ENCONTRADO = "El lote de insumo no fue encontrado."
    INGREDIENTE_NO_ENCONTRADO = "El ingrediente no existe o está dado de baja."
    PROVEEDOR_NO_ENCONTRADO = "El proveedor no existe o fue dado de baja."
    INSUMO_NO_ENCONTRADO = "El insumo no existe o está dado de baja."
    INSUMO_NO_HOMOLOGADO = (
        "No se puede recibir el lote: el insumo (marca) no está homologado. "
        "Cargá su rótulo y aprobalo en la ficha del ingrediente."
    )
    PROVEEDOR_NO_VENDE_INSUMO = (
        "Ese proveedor no tiene asociado el insumo. Asociáselo en la ficha del proveedor o del ingrediente."
    )
    LOTE_YA_EXISTE = (
        "Ya existe un lote de ese ingrediente con ese número para ese proveedor."
    )
    NUMERO_VACIO = "El número de lote del proveedor no puede estar vacío."
    MOTIVO_VACIO = "El motivo de la baja no puede estar vacío."
    MOTIVO_INVALIDO = (
        "Motivo inválido. Valores permitidos: dañado, vencido, contaminado o devuelto al proveedor."
    )
    CANTIDAD_BAJA_INVALIDA = "La cantidad a dar de baja debe ser mayor a cero."
    CANTIDAD_SUPERA_SALDO = "La cantidad a dar de baja supera el saldo disponible del lote."
    LOTE_YA_DADO_DE_BAJA = "El lote de insumo ya fue dado de baja."
    VENCIMIENTO_ANTERIOR = (
        "La fecha de vencimiento no puede ser anterior a la fecha de ingreso."
    )
    CERTIFICACION_NO_VIGENTE = "No se puede recibir el lote: el proveedor no tiene una certificación vigente en la fecha de ingreso."
    