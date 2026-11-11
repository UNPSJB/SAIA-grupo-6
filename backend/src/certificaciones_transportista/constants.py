class ErrorCode:
    CERTIFICACION_NO_ENCONTRADA = "La certificación no fue encontrada."
    TRANSPORTISTA_NO_ENCONTRADO = "El transportista no fue encontrado."
    ARCHIVO_INVALIDO = "El archivo adjunto no es válido (solo PDF o imagen)."
    ARCHIVO_DEMASIADO_GRANDE = "El archivo excede el tamaño máximo permitido de 10 MB."
    FECHA_VENCIMIENTO_INVALIDA = (
        "La fecha de vencimiento debe ser igual o posterior a la fecha de emisión."
    )
    TIPO_VACIO = "El tipo de certificación es obligatorio."
    NUMERO_VACIO = "El número de certificación es obligatorio."
    MOTIVO_ANULACION_REQUERIDO = "El motivo de anulación es obligatorio."
    CERTIFICACION_YA_ANULADA = "La certificación ya está anulada."
    CERTIFICACION_INMUTABLE = (
        "Solo se pueden modificar las observaciones y el comprobante."
    )
    CERTIFICACION_YA_ACTIVA = (
        "Ya existe una certificación activa de este tipo para el transportista."
    )
