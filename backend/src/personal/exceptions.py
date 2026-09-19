from src.exceptions import NotFound, BadRequest
from src.personal.constants import ErrorCode

class PersonaNoEncontrada(NotFound):
    DETAIL = ErrorCode.PERSONA_NO_ENCONTRADA

class DatoDuplicado(BadRequest):
    DETAIL = ErrorCode.DATO_DUPLICADO

class NombreInvalido(BadRequest):
    DETAIL = ErrorCode.NOMBRE_INVALIDO

class DniInvalido(BadRequest):
    DETAIL = ErrorCode.DNI_INVALIDO

class EmailInvalido(BadRequest):
    DETAIL = ErrorCode.EMAIL_INVALIDO