from src.exceptions import NotFound, BadRequest 
from src.insumoQuimico.constants import ErrorCode 

class InsumoQuimicoNoEncontrado(NotFound): 
    DETAIL = ErrorCode.INSUMO_QUIMICO_NO_ENCONTRADO 
class InsumoQuimicoYaExiste(BadRequest): 
    DETAIL = ErrorCode.INSUMO_QUIMICO_YA_EXISTE 
class NombreVacio(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_VACIO 
class NombreInvalido(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_INVALIDO 