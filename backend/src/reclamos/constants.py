"""Constantes del dominio de reclamos de clientes (Historia 20)."""

# Tipo de hito que se agrega a la línea de tiempo del lote.
TIPO_EVENTO_RECLAMO = "RECLAMO"

MOTIVO_SABOR_OLOR_ASPECTO = "sabor_olor_aspecto"
MOTIVO_ENVASE_DANADO = "envase_danado"
MOTIVO_CUERPO_EXTRANO = "cuerpo_extrano"
MOTIVO_AFECTACION_SALUD = "posible_afectacion_salud"
MOTIVO_ROTULADO_ETIQUETA = "rotulado_etiqueta"
MOTIVO_DEVOLUCION_RECALL = "Devolución de lote por alerta de recall/retiro"
MOTIVO_DEVOLUCION_RECALL_KEY = "devolucion_recall_retiro"
MOTIVO_OTRO = "otro"

MOTIVOS_RECLAMO = (
    MOTIVO_SABOR_OLOR_ASPECTO,
    MOTIVO_ENVASE_DANADO,
    MOTIVO_CUERPO_EXTRANO,
    MOTIVO_AFECTACION_SALUD,
    MOTIVO_ROTULADO_ETIQUETA,
    MOTIVO_DEVOLUCION_RECALL,
    MOTIVO_DEVOLUCION_RECALL_KEY,
    MOTIVO_OTRO,
)

ETIQUETAS_MOTIVO_RECLAMO = {
    MOTIVO_SABOR_OLOR_ASPECTO: "Sabor, olor o aspecto anormal",
    MOTIVO_ENVASE_DANADO: "Envase dañado",
    MOTIVO_CUERPO_EXTRANO: "Cuerpo extraño",
    MOTIVO_AFECTACION_SALUD: "Posible afectación a la salud",
    MOTIVO_ROTULADO_ETIQUETA: "Rotulado o etiqueta",
    MOTIVO_DEVOLUCION_RECALL: "Devolución de lote por alerta de recall/retiro",
    MOTIVO_DEVOLUCION_RECALL_KEY: "Devolución de lote por alerta de recall/retiro",
    MOTIVO_OTRO: "Otro",
}

# Motivo que exige detalle libre.
MOTIVO_RECLAMO_OTRO = MOTIVO_OTRO


class ErrorCode:
    RECLAMO_YA_CERRADO = "El reclamo ya está cerrado."
    RECLAMO_NO_CERRADO = "El reclamo no está cerrado."
    REPOSICION_YA_GENERADA = (
        "Este reclamo ya generó una reposición para el cliente: no se puede "
        "generar otra."
    )
    RECLAMO_SIN_INCIDENTE = "El reclamo no tiene un incidente asociado que cerrar."
    RECLAMO_NO_ENCONTRADO = "El reclamo no existe."
    SALIDA_NO_ENTREGADA = (
        "Solo se puede reclamar sobre una salida entregada."
    )
    FECHA_INVALIDA = (
        "La fecha del reclamo no puede ser anterior a la fecha de entrega "
        "ni posterior a hoy."
    )
    MOTIVO_INVALIDO = "El motivo del reclamo no es válido."
    DETALLE_REQUERIDO = "El detalle del reclamo es obligatorio cuando el motivo es 'Otro'."
    DETALLE_DEMASIADO_LARGO = (
        "El detalle del reclamo no puede superar los 500 caracteres."
    )
