from typing import List
from src.insumos.constants import ErrorCode
from src.exceptions import NotFound, BadRequest


class InsumoYaExiste(BadRequest):
    DETAIL = ErrorCode.INSUMO_YA_EXISTE

class InsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO

class TipoUnidadInvalido(ValueError):
    def __init__(self, posibles_tipos: List[str]):
        posibles_tipos = ", ".join(posibles_tipos)
        message = f"{ErrorCode.TIPO_UNIDAD_INVALIDO} {posibles_tipos}."
        super().__init__(message)