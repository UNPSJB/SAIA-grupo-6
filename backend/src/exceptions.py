from typing import Any, Dict

from fastapi import HTTPException, status


class DetailedHTTPException(HTTPException):
    STATUS_CODE = status.HTTP_500_INTERNAL_SERVER_ERROR
    DETAIL = "Error del servidor"

    def __init__(self, **kwargs: Dict[str, Any]) -> None:
        super().__init__(status_code=self.STATUS_CODE, detail=self.DETAIL, **kwargs)


class PermissionDenied(DetailedHTTPException):
    STATUS_CODE = status.HTTP_403_FORBIDDEN
    DETAIL = "Permiso denegado"


class NotFound(DetailedHTTPException):
    STATUS_CODE = status.HTTP_404_NOT_FOUND
    DETAIL = "No encontrado"


class BadRequest(DetailedHTTPException):
    STATUS_CODE = status.HTTP_400_BAD_REQUEST
    DETAIL = "Solicitud incorrecta"


class UnprocessableContent(DetailedHTTPException):
    STATUS_CODE = status.HTTP_422_UNPROCESSABLE_CONTENT
    DETAIL = "Contenido no procesable"


class NotAuthenticated(DetailedHTTPException):
    STATUS_CODE = status.HTTP_401_UNAUTHORIZED
    DETAIL = "Usuario no autorizado"

    def __init__(self) -> None:
        super().__init__(headers={"WWW-Authenticate": "Bearer"})

class ConflictoRegistroInactivo(HTTPException):
    """
    Se lanza cuando ya existe un registro con el mismo valor único
    (dni, email, nombre, número de serie, etc.) pero está dado de baja
    lógicamente (activo=False).

    A diferencia de un error de negocio común, este no debe bloquear
    silenciosamente al usuario: el frontend puede leer `id` y `campo`
    del detail y ofrecerle reactivar ese registro con los datos nuevos
    en vez de simplemente rechazar la operación.

    Reutilizable por cualquier entidad con baja lógica (Personal, Equipo,
    Insumos), ya que no depende de ningún campo específico de una entidad.
    """

    def __init__(self, mensaje: str, entidad_id: int, campo: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={"mensaje": mensaje, "id": entidad_id, "campo": campo, "tipo": "inactivo"},
        )
