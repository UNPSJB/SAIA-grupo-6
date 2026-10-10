from enum import Enum


class TipoTarea(str, Enum):
    """Momento del proceso productivo en el que se realiza la tarea.

    Igual que el estado de un incidente, se guarda como texto plano en la
    columna y se valida contra este enum en el schema.
    """

    PREOPERACIONAL = "preoperacional"
    OPERACIONAL = "operacional"
    POSTOPERACIONAL = "postoperacional"


class ErrorCode:
    TAREA_NO_ENCONTRADA = "La tarea solicitada no existe o fue dada de baja."
    TIPO_INVALIDO = "El tipo de tarea seleccionado no es válido."
    NOMBRE_INVALIDO = (
        "El nombre de la tarea no puede estar vacío y debe contener solo letras."
    )
    NOMBRE_DUPLICADO = "Ya existe una tarea con ese nombre."
    DATO_DUPLICADO = "Ya existe un registro activo con esos datos."
    PLAN_LIMPIEZA_ID_INVALIDO = "El plan de limpieza indicado no es válido."
    PLAN_LIMPIEZA_NO_ENCONTRADO = "El plan de limpieza no existe o fue dado de baja."
    FRECUENCIA_INVALIDA = "La frecuencia debe ser mayor a cero."
