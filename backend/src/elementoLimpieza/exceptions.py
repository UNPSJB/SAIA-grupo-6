from fastapi import HTTPException, status
from typing import List
from src.elementoLimpieza.constants import ErrorCode
from src.exceptions import NotFound, BadRequest
from src.exceptions import BadRequest, NotFound

"""
class ElementoLimpiezaNoEncontrado(HTTPException):
    def __init__(self, elementolimpieza_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el elemento limpieza con id {elementolimpieza_id}"
        )



class ElementoLimpiezaYaExiste(Exception):

  def __init__(self, nombre: str):
    self.nombre = nombre
    super().__init__(f"Ya existe un elemento de limpieza con el nombre '{nombre}'")
"""

class NombreVacio(BadRequest):
    DETAIL = ErrorCode.NOMBRE_VACIO

class ElementoLimpiezaNoEncontrado(NotFound): 
    DETAIL = ErrorCode.ELEMENTO_NO_ENCONTRADO 

class ElementoLimpiezaYaExiste(BadRequest): 
    DETAIL = ErrorCode.ELEMENTO_YA_EXISTE 

class NombreInvalido(BadRequest): 
    DETAIL = ErrorCode.NOMBRE_INVALIDO 
