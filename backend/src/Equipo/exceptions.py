from src.exceptions import NotFound, BadRequest
from src.Equipo.constants import ErrorCode


class EquipoNoEncontrado(NotFound):
    """404. Antes heredaba de `HTTPException` directo y ademas construía el
    detail a mano, así que no compartía la jerarquía de `src/exceptions.py`."""

    def __init__(self, equipo_id: int):
        super().__init__()
        self.detail = ErrorCode.EQUIPO_NO_ENCONTRADO.format(equipo_id=equipo_id)


class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO


class UbicacionVacia(BadRequest):
    DETAIL = ErrorCode.UBICACION_VACIA


class TipoVacio(BadRequest):
    DETAIL = ErrorCode.TIPO_VACIO


class NombreDuplicado(BadRequest):
    DETAIL = ErrorCode.NOMBRE_DUPLICADO
