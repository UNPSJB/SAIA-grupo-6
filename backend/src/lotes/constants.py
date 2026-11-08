ESTADO_EN_PROCESO = "en_proceso"
ESTADO_TERMINADO = "terminado"
ESTADO_CANCELADO = "cancelado"
ESTADOS_LOTE = (ESTADO_EN_PROCESO, ESTADO_TERMINADO, ESTADO_CANCELADO)
ESTADOS_LOTE_CERRADOS = (ESTADO_TERMINADO, ESTADO_CANCELADO)

TIPO_CONSUMO_REAL = "real"
TIPO_CONSUMO_DESPERDICIO = "desperdicio"
TIPOS_CONSUMO = (TIPO_CONSUMO_REAL, TIPO_CONSUMO_DESPERDICIO)

PREFIJO_NUMERO_LOTE = "LP"


class ErrorCode:
    LOTE_NO_ENCONTRADO = "El lote de producción no fue encontrado."
    ITEM_NO_ENCONTRADO = "El ítem del checklist no pertenece a este lote."
    PRODUCTO_NO_ENCONTRADO = "El producto no existe o fue dado de baja."
    PRODUCTO_SIN_RECETA = "El producto no tiene una receta con versiones para elaborar."
    LOTE_CERRADO = "El lote está terminado o cancelado y es de solo lectura."
    ITEM_YA_COMPLETADO = "El ítem del checklist ya fue completado."
    CHECKLIST_INCOMPLETO = "Faltan ítems del checklist por completar."
    CANTIDAD_PRODUCIDA_INVALIDA = "La cantidad producida debe ser mayor a cero."
    MOTIVO_VACIO = "El motivo de cancelación no puede estar vacío."
    LOTE_INSUMO_NO_ENCONTRADO = "El lote de insumo no existe."
    LOTE_INSUMO_DADO_DE_BAJA = "El lote de insumo está dado de baja y no se puede consumir."
    INSUMO_NO_PREVISTO = "El insumo de ese lote no está asignado a esta tarea de la receta."
    NUMERO_LOTE_NO_GENERADO = "No se pudo generar un número de lote único."
    TIPO_CONSUMO_INVALIDO = "El tipo de consumo debe ser 'real' o 'desperdicio'."
