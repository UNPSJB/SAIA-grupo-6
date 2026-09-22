from src.exceptions import BadRequest
from src.checklist.constants import ErrorCode


class FechaInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_INVALIDA


class EquipoIdInvalido(BadRequest):
    DETAIL = ErrorCode.EQUIPO_ID_INVALIDO

# Nota: para "tarea no encontrada" y "equipo no encontrado" reutilizamos las
# excepciones ya definidas en src.tareas.exceptions y src.Equipo.exceptions,
# para no duplicar mensajes de error entre módulos.
