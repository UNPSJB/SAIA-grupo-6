from typing import List
from src.mascotas.constants import ErrorCode
from src.exceptions import NotFound, BadRequest


class MascotaNoEncontrada(NotFound):
    DETAIL = ErrorCode.MASCOTA_NO_ENCONTRADA


class NombreDuplicado(BadRequest):
    DETAIL = ErrorCode.NOMBRE_DUPLICADO


class TipoMascotaInvalido(ValueError):
    def __init__(self, posibles_tipos: List[str]):
        posibles_tipos = ", ".join(posibles_tipos)
        message = f"{ErrorCode.TIPO_MASCOTA_INVALIDO} {posibles_tipos}."
        super().__init__(message)
