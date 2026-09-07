from src.exceptions import NotFound, BadRequest
from src.personal.constants import ErrorCode

class PersonaNoEncontrada(NotFound):
    DETAIL = ErrorCode.PERSONA_NO_ENCONTRADA

class DatoDuplicado(BadRequest):
    DETAIL = ErrorCode.DATO_DUPLICADO