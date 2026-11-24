"""Estados y constantes del dominio de salidas de producto."""

ESTADO_RESERVADO = "RESERVADO"
ESTADO_DESPACHADO = "DESPACHADO"
ESTADO_ENTREGADO = "ENTREGADO"
ESTADO_CANCELADO = "CANCELADO"
# La salida queda rechazada por el cliente. Es un estado final respecto de las
# transiciones de estado: la decisión posterior (reingresar o desechar) NO lo
# cambia, se guarda en los campos de disposición.
ESTADO_RECHAZADA = "RECHAZADA"

ESTADOS_SALIDA = (
    ESTADO_RESERVADO,
    ESTADO_DESPACHADO,
    ESTADO_ENTREGADO,
    ESTADO_CANCELADO,
    ESTADO_RECHAZADA,
)

TIPO_EVENTO_RESERVA = "RESERVA"
TIPO_EVENTO_DESPACHO = "DESPACHO"
TIPO_EVENTO_ENTREGA = "ENTREGA"
TIPO_EVENTO_CANCELACION = "CANCELACION"
TIPO_EVENTO_RECHAZO = "RECHAZO"
TIPO_EVENTO_DISPOSICION = "DISPOSICION"

# Motivos de rechazo. Es una lista fija y breve: el detalle libre acompaña
# siempre al motivo y es obligatorio cuando se elige "otro".
MOTIVO_RECHAZO_DANO_TRANSPORTE = "dano_transporte"
MOTIVO_RECHAZO_TEMPERATURA = "temperatura_inadecuada"
MOTIVO_RECHAZO_NO_CONFORME = "producto_no_conforme"
MOTIVO_RECHAZO_ERROR_PEDIDO = "error_pedido"
MOTIVO_RECHAZO_RETIRO_RECALL = "retiro_recall"
MOTIVO_RECHAZO_OTRO = "otro"

MOTIVOS_RECHAZO = (
    MOTIVO_RECHAZO_DANO_TRANSPORTE,
    MOTIVO_RECHAZO_TEMPERATURA,
    MOTIVO_RECHAZO_NO_CONFORME,
    MOTIVO_RECHAZO_ERROR_PEDIDO,
    MOTIVO_RECHAZO_RETIRO_RECALL,
    MOTIVO_RECHAZO_OTRO,
)

ETIQUETAS_MOTIVO_RECHAZO = {
    MOTIVO_RECHAZO_DANO_TRANSPORTE: "Daño en el transporte",
    MOTIVO_RECHAZO_TEMPERATURA: "Temperatura inadecuada",
    MOTIVO_RECHAZO_NO_CONFORME: "Producto no conforme",
    MOTIVO_RECHAZO_ERROR_PEDIDO: "Error de pedido",
    MOTIVO_RECHAZO_RETIRO_RECALL: "Devolución de lote por alerta de recall/retiro",
    MOTIVO_RECHAZO_OTRO: "Otro",
}

# Destino de la mercadería rechazada.
DISPOSICION_REINGRESADA = "REINGRESADA"
DISPOSICION_DESECHADA = "DESECHADA"

DISPOSICIONES = (DISPOSICION_REINGRESADA, DISPOSICION_DESECHADA)

# Formas de entrega permitidas al despachar.
FORMA_ENTREGA_CON_TRANSPORTISTA = "CON_TRANSPORTISTA"
FORMA_ENTREGA_RETIRA_CLIENTE = "RETIRA_CLIENTE"


class ErrorCode:
    LOTE_NO_ENCONTRADO = "El lote no existe."
    LOTE_RETIRADO = "El lote está retirado y no se pueden hacer reservas."
    CLIENTE_NO_ENCONTRADO = "El cliente no existe."
    CLIENTE_INACTIVO = "El cliente está dado de baja y no se puede reservar."
    CANTIDAD_INVALIDA = "La cantidad debe ser mayor a cero."
    CANTIDAD_NO_ENTERA = "El producto se vende por unidad: la cantidad tiene que ser un número entero."
    SALDO_INSUFICIENTE = "No hay saldo suficiente en el lote para esa reserva."
    FECHA_ANTERIOR_A_ELABORACION = (
        "La fecha de reserva no puede ser anterior a la fecha de elaboración del lote."
    )
    SALIDA_NO_ENCONTRADA = "La salida no existe."
    TRANSICION_INVALIDA = "Transición de estado no permitida."
    TRANSPORTISTA_REQUERIDO = (
        "El transportista es obligatorio cuando la forma de entrega es con transportista."
    )
    TRANSPORTISTA_NO_PERMITIDO = (
        "El transportista no debe indicarse cuando el cliente retira en planta."
    )
    TRANSPORTISTA_NO_ENCONTRADO = "El transportista no existe."
    TRANSPORTISTA_INACTIVO = "El transportista está dado de baja."
    TRANSPORTISTA_NO_HABILITADO = (
        "El transportista no tiene certificaciones vigentes al momento del despacho."
    )
    FECHA_INVALIDA = "La fecha indicada no es válida."
    MOTIVO_REQUERIDO = "El motivo es obligatorio."
    LOTE_VENCIDO = "El lote se encuentra vencido y no puede ser reservado ni despachado."
    FECHA_RESERVA_FUTURA = "La fecha de reserva no puede ser posterior a hoy."
    # Rechazo de una entrega y resolución posterior.
    MOTIVO_RECHAZO_INVALIDO = "El motivo de rechazo no es válido."
    DETALLE_RECHAZO_REQUERIDO = (
        "El detalle del rechazo es obligatorio cuando el motivo es 'Otro'."
    )
    DETALLE_RECHAZO_DEMASIADO_LARGO = (
        "El detalle del rechazo no puede superar los 500 caracteres."
    )
    FECHA_RECHAZO_INVALIDA = (
        "La fecha de rechazo no puede ser anterior a la fecha de despacho "
        "ni posterior a hoy."
    )
    DISPOSICION_INVALIDA = "La disposición del rechazo no es válida."
    RECHAZO_YA_RESUELTO = (
        "El rechazo ya fue resuelto. La decisión no se puede modificar."
    )
    JUSTIFICACION_REQUERIDA = "La justificación de la disposición es obligatoria."
    JUSTIFICACION_DEMASIADO_LARGA = (
        "La justificación de la disposición no puede superar los 500 caracteres."
    )
    REINGRESO_LOTE_VENCIDO = (
        "No se puede reingresar la mercadería al lote porque está vencido. "
        "Solo se puede desechar."
    )
    REINGRESO_LOTE_RETIRADO = (
        "No se puede reingresar la mercadería al lote porque está retirado. "
        "Solo se puede desechar."
    )
