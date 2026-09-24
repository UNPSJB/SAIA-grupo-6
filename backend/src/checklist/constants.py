from enum import Enum


class ErrorCode(str, Enum):
    FECHA_INVALIDA = "fecha_invalida"
    EQUIPO_ID_INVALIDO = "equipo_id_invalido"
    CHECKLIST_INMUTABLE = "checklist_inmutable"
    CHECKLIST_FUTURO = "checklist_futuro"