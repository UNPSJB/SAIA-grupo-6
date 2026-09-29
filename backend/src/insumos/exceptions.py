from src.insumos.constants import ErrorCode
from src.exceptions import NotFound, BadRequest


class InsumoYaExiste(BadRequest):
    DETAIL = ErrorCode.INSUMO_YA_EXISTE

class InsumoNoEncontrado(NotFound):
    DETAIL = ErrorCode.INSUMO_NO_ENCONTRADO

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO

class UnidadMedidaNoExiste(BadRequest):
    DETAIL = "La unidad de medida seleccionada no existe."

class UnidadMedidaInactiva(BadRequest):
    DETAIL = "La unidad de medida seleccionada está inactiva."