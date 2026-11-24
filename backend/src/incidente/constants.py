from enum import Enum


class TipoIncidente(str, Enum):
    PLAGAS = "plagas"
    FALLA_EQUIPO = "falla_equipo"
    HIGIENE_CONTAMINACION = "higiene_contaminacion"
    # Se abre automáticamente desde salidas cuando un cliente rechaza una
    # entrega (Historia A del circuito de rechazos). No es un valor editable:
    # los tipos son una lista fija, igual que el resto.
    ENTREGA_RECHAZADA = "entrega_rechazada"
    # Se abre automáticamente desde el alta de un reclamo de cliente
    # (Historia 20). Tampoco es un valor editable a mano: se cierra y se
    # reabre desde la ficha del reclamo.
    RECLAMO_CLIENTE = "reclamo_cliente"
    # Se abre automáticamente al iniciar un retiro de lote del mercado
    # (Historia 21). Es un incidente de sistema: no se puede cerrar, reabrir
    # ni editar desde los endpoints de E6.
    RETIRO_LOTE = "retiro_lote"
    OTRO = "otro"


# Los que nacen de otro circuito (un rechazo, un reclamo o un retiro) y se
# resuelven ahí. En la gestión de incidentes son de solo lectura.
TIPOS_DE_CIRCUITO = (
    TipoIncidente.ENTREGA_RECHAZADA,
    TipoIncidente.RECLAMO_CLIENTE,
    TipoIncidente.RETIRO_LOTE,
)


class OrigenIncidente(str, Enum):
    """De dónde salió el incidente: lo reportó alguien o lo abrió un circuito."""

    REPORTADO = "reportado"
    CIRCUITO = "circuito"


class EstadoIncidente(str, Enum):
    """Ciclo de vida del incidente.

    Antes el cierre se manejaba con un boolean `activo` que en realidad
    representaba la baja lógica. Ahora el estado es explícito: un incidente
    se abre al reportarse y el administrador lo cierra cuando resuelve.
    """

    ABIERTO = "abierto"
    CERRADO = "cerrado"


class ErrorCode:
    INCIDENTE_NO_ENCONTRADO = "El incidente no fue encontrado."
    DESCRIPCION_VACIA = "La descripción del incidente no puede estar vacía."
    TITULO_VACIO = "El título del incidente no puede estar vacío."
    TITULO_DEMASIADO_LARGO = "El título del incidente no puede superar los 60 caracteres."
    TIPO_INVALIDO = "El tipo de incidente seleccionado no es válido."
    EQUIPO_NO_ENCONTRADO = "El equipo seleccionado no existe."
    USUARIO_NO_ENCONTRADO = "El usuario que reporta no existe."
    USUARIO_INACTIVO = "El usuario que reporta está inactivo."
    EQUIPO_INACTIVO = "El equipo seleccionado está dado de baja."
    PERMISO_DENEGADO = "No tenés permiso para ver este incidente."
    FECHA_RANGO_INVALIDO = "La fecha 'desde' no puede ser posterior a la fecha 'hasta'."
    INCIDENTE_INMUTABLE = (
        "Este incidente se resuelve desde donde se originó: el rechazo en su "
        "salida, el reclamo en su ficha o el retiro del lote."
    )


# Formatos y tamaño máximo de la foto del incidente. Vive acá para que otros
# flujos que abren incidentes (por ejemplo el rechazo de una entrega) usen
# exactamente el mismo criterio de validación.
EXTENSIONES_FOTO = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX_FOTO = 5 * 1024 * 1024  # 5 MB
