from fastapi import HTTPException, status
from typing import List
from src.insumos.constants import ErrorCode
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

class ElementoLimpiezaYaExiste(BadRequest):
    DETAIL = "Ya existe un elemento de limpieza con ese nombre"

class ElementoLimpiezaNoEncontrado(NotFound):
    DETAIL = "No se encontró el elemento de limpieza"