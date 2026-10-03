from src.elementoLimpieza.constants import ErrorCode
from src.exceptions import NotFound, BadRequest

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO

class ElementoLimpiezaNoEncontrado(NotFound): 
    DETAIL = ErrorCode.ELEMENTO_NO_ENCONTRADO 

class ElementoLimpiezaYaExiste(BadRequest): 
    DETAIL = ErrorCode.ELEMENTO_YA_EXISTE 

class NombreInvalido(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_INVALIDO 
