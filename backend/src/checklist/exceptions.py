from fastapi import status

from src.exceptions import BadRequest, DetailedHTTPException, NotFound
from src.checklist.constants import ErrorCode


class FechaInvalida(BadRequest):
    DETAIL = ErrorCode.FECHA_INVALIDA


class ChecklistFuturo(BadRequest):
    """El checklist de una fecha futura es solo una previsualización en
    memoria (ver services.obtener_o_crear_checklist, caso de fecha futura):
    no existe todavía en la base, así que no hay nada que marcar."""

    DETAIL = ErrorCode.CHECKLIST_FUTURO


class TareaNoCorrespondeALaFecha(BadRequest):
    DETAIL = ErrorCode.TAREA_NO_CORRESPONDE_A_LA_FECHA


class CantidadConsumidaInvalida(BadRequest):
    DETAIL = ErrorCode.CANTIDAD_CONSUMIDA_INVALIDA


class ChecklistInmutable(DetailedHTTPException):
    """El checklist corresponde a un día anterior: ya quedó cerrado como
    dato histórico y no admite modificaciones (ni en su cabecera ni en
    sus registro_tareas)."""

    STATUS_CODE = status.HTTP_409_CONFLICT
    DETAIL = ErrorCode.CHECKLIST_INMUTABLE


class ActualizacionConcurrente(DetailedHTTPException):
    STATUS_CODE = status.HTTP_409_CONFLICT
    DETAIL = "La tarea fue actualizada por otra operación. Actualizá la pantalla e intentá nuevamente."

# Nota: para "tarea no encontrada" y "equipo no encontrado" reutilizamos las
# excepciones ya definidas en src.tareas.exceptions y src.Equipo.exceptions,
# para no duplicar mensajes de error entre módulos.


class InsumoQuimicoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_QUIMICO_NO_ENCONTRADO


class ElementoLimpiezaNoEncontrado(NotFound):
    DETAIL = ErrorCode.ELEMENTO_LIMPIEZA_NO_ENCONTRADO


class RegistroTareaNoEncontrado(NotFound):
    DETAIL = ErrorCode.REGISTRO_TAREA_NO_ENCONTRADO


class ChecklistNoEncontrado(NotFound):
    DETAIL = ErrorCode.CHECKLIST_NO_ENCONTRADO
