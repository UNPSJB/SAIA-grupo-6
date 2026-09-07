from fastapi import HTTPException, status
from typing import List
from src.insumos.constants import ErrorCode
from src.exceptions import NotFound, BadRequest

class EquipoNoEncontrado(HTTPException):
    def __init__(self, equipo_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el equipo con id {equipo_id}"
        )

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class UbicacionVacia(BadRequest):
    DETAIL = ErrorCode.UBICACION_VACIA


class TipoUnidadInvalido(ValueError):
    def init(self, posibles_tipos: List[str]):
        posibles_tipos = ", ".join(posibles_tipos)
        message = f"{ErrorCode.TIPO_UNIDAD_INVALIDO} {posibles_tipos}."
        super().init(message)