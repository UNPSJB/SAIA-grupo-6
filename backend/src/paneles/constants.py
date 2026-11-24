"""Constantes de los paneles de categoría."""

# Largo máximo del período que se puede pedir (un poco más de dos años).
MAXIMO_DIAS_PERIODO = 800

# Hasta cuántos días de período se agrupa por día / por semana; más, por mes.
MAXIMO_DIAS_POR_DIA = 31
MAXIMO_DIAS_POR_SEMANA = 184

# Un lote, un plan o una aptitud "está por vencer" si faltan estos días o menos.
DIAS_POR_VENCER = 7

# Filas de las listas de atención y de los rankings.
FILAS_LISTA = 6
FILAS_RANKING = 8

MESES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")


class ErrorCode:
    RANGO_INVALIDO = "La fecha 'desde' no puede ser posterior a la fecha 'hasta'."
    PERIODO_DEMASIADO_LARGO = (
        f"El período no puede superar los {MAXIMO_DIAS_PERIODO} días."
    )


ETIQUETA_ESTADO_LOTE = {
    "en_proceso": "En proceso",
    "terminado": "Terminados",
    "cancelado": "Cancelados",
}

ETIQUETA_ESTADO_SALIDA = {
    "RESERVADO": "Reservadas",
    "DESPACHADO": "Despachadas",
    "ENTREGADO": "Entregadas",
    "CANCELADO": "Canceladas",
    "RECHAZADA": "Rechazadas",
}

# Clave del conteo de ingredientes según sean aditivos o no.
ETIQUETA_ADITIVO = {
    "aditivo": "Aditivos",
    "otro": "No aditivos",
}

ETIQUETA_ESTADO_CHECKLIST = {
    "abierto": "Abiertos",
    "completo": "Completos",
    "observado": "Observados",
    "cerrado": "Cerrados",
}

ETIQUETA_MOMENTO_TAREA = {
    "preoperacional": "Preoperacional",
    "operacional": "Operacional",
    "postoperacional": "Postoperacional",
}

ETIQUETA_TIPO_INCIDENTE = {
    "plagas": "Plagas",
    "falla_equipo": "Falla de equipo",
    "higiene_contaminacion": "Higiene o contaminación",
    "entrega_rechazada": "Entrega rechazada",
    "reclamo_cliente": "Reclamo de cliente",
    "retiro_lote": "Retiro de lote",
    "otro": "Otro",
}

ETIQUETA_TIPO_VENCIMIENTO = {
    "PERSONAL": "Aptitudes del personal",
    "CALIBRACION": "Calibraciones",
    "MANTENIMIENTO": "Mantenimientos",
    "DOCUMENTO": "Documentos",
}
