from enum import Enum


class TipoIncidente(str, Enum):
    PLAGAS = "plagas"
    FALLA_EQUIPO = "falla_equipo"
    DEVOLUCION_CLIENTE = "devolucion_cliente"
    HIGIENE_CONTAMINACION = "higiene_contaminacion"
    # Se abre automáticamente desde salidas cuando un cliente rechaza una
    # entrega (Historia A del circuito de rechazos). No es un valor editable:
    # los tipos son una lista fija, igual que el resto.
    ENTREGA_RECHAZADA = "entrega_rechazada"
    # Se abre automáticamente desde el alta de un reclamo de cliente
    # (Historia 20). Tampoco es un valor editable a mano.
    RECLAMO_CLIENTE = "reclamo_cliente"
    # Se abre automáticamente al iniciar un retiro de lote del mercado
    # (Historia 21). Es un incidente de sistema: no se puede cerrar, reabrir
    # ni editar desde los endpoints de E6.
    RETIRO_LOTE = "retiro_lote"
    OTRO = "otro"


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
    ESTADO_INVALIDO = "El estado del incidente no es válido."
    EQUIPO_INACTIVO = "El equipo seleccionado está dado de baja."
    PERMISO_DENEGADO = "No tenés permiso para ver este incidente."
    FECHA_RANGO_INVALIDO = "La fecha 'desde' no puede ser posterior a la fecha 'hasta'."
    INCIDENTE_INMUTABLE = (
        "Los incidentes generados por un rechazo de mercadería son inmutables. "
        "Este incidente se resuelve desde Resolver rechazo en Salidas."
    )


# Formatos y tamaño máximo de la foto del incidente. Vive acá para que otros
# flujos que abren incidentes (por ejemplo el rechazo de una entrega) usen
# exactamente el mismo criterio de validación.
EXTENSIONES_FOTO = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX_FOTO = 5 * 1024 * 1024  # 5 MB
