from enum import Enum


class TipoIncidente(str, Enum):
    PLAGAS = "plagas"
    FALLA_EQUIPO = "falla_equipo"
    DEVOLUCION_CLIENTE = "devolucion_cliente"
    HIGIENE_CONTAMINACION = "higiene_contaminacion"
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
    TIPO_INVALIDO = "El tipo de incidente seleccionado no es válido."
    EQUIPO_NO_ENCONTRADO = "El equipo seleccionado no existe."
    USUARIO_NO_ENCONTRADO = "El usuario que reporta no existe."
    USUARIO_INACTIVO = "El usuario que reporta está inactivo."
    ESTADO_INVALIDO = "El estado del incidente no es válido."
    EQUIPO_INACTIVO = "El equipo seleccionado está dado de baja."
    PERMISO_DENEGADO = "No tenés permiso para ver este incidente."
