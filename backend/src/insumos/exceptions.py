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

class AditivoSinReferencia(BadRequest):
    DETAIL = (
        "Un aditivo debe elegirse de la lista de referencia "
        "(clase funcional, nombre completo e INS)."
    )

class AditivoNoValido(BadRequest):
    DETAIL = "El aditivo elegido no existe o está dado de baja en la lista de referencia."
