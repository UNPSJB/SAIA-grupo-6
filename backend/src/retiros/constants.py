"""Constantes del dominio de retiros de lote (Historia 21)."""

MOTIVOS_RETIRO = (
    "Contaminación o cuerpo extraño",
    "Reclamos de clientes",
    "Falla en el proceso de elaboración",
    "Insumo defectuoso",
    "Error de rotulado o alérgenos",
    "Aviso o recall del proveedor",
    "Resultado de análisis no conforme",
    "Contaminación cruzada en origen",
    "Insumo fuera de especificación o vencido",
    "Otro",
)

MEDIOS_CONTACTO_RETIRO = (
    "Teléfono",
    "Email",
    "WhatsApp",
    "Nota formal / Presencial",
    "Otro",
)

# Estados de retiro
ESTADO_RETIRO_EN_CURSO = "EN_CURSO"
ESTADO_RETIRO_CERRADO = "CERRADO"
ESTADOS_RETIRO = (ESTADO_RETIRO_EN_CURSO, ESTADO_RETIRO_CERRADO)

# Orígenes de retiro
ORIGEN_RETIRO_MANUAL = "MANUAL"
ORIGEN_RETIRO_RECLAMO = "RECLAMO"
ORIGEN_RETIRO_INSUMO = "INSUMO"
ORIGENES_RETIRO = (ORIGEN_RETIRO_MANUAL, ORIGEN_RETIRO_RECLAMO, ORIGEN_RETIRO_INSUMO)

# Estados de notificación
ESTADO_NOTIFICACION_PENDIENTE = "PENDIENTE"
ESTADO_NOTIFICACION_NOTIFICADO = "NOTIFICADO"
ESTADOS_NOTIFICACION = (
    ESTADO_NOTIFICACION_PENDIENTE,
    ESTADO_NOTIFICACION_NOTIFICADO,
)

# Tipos de evento de hito para retiros
TIPO_EVENTO_RETIRO = "RETIRO"
TIPO_EVENTO_NOTIFICACION_RETIRO = "NOTIFICACION_RETIRO"
TIPO_EVENTO_CIERRE_RETIRO = "CIERRE_RETIRO"

# Tipo de incidente de sistema asociado a un retiro de lote
TIPO_INCIDENTE_RETIRO_LOTE = "retiro_lote"


class ErrorCode:
    LOTE_YA_RETIRO = "El lote ya está retirado del mercado."
    RETIRO_NO_ENCONTRADO = "El retiro no existe."
    RETIRO_FECHA_INVALIDA = "La fecha de retiro no es válida."
    RETIRO_MOTIVO_INVALIDO = "El motivo de retiro no es válido."
    MEDIO_CONTACTO_INVALIDO = "El medio de contacto no es válido."
    RETIRO_YA_CERRADO = "El retiro ya está cerrado."
    AFECTADO_YA_NOTIFICADO = "El afectado ya fue notificado."
    AFECTADOS_PENDIENTES = "Quedan afectados pendientes de notificación."
    RECLAMO_NO_CORRESPONDE_AL_LOTE = "El reclamo no pertenece al lote indicado."
