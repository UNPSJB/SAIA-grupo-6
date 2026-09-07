from fastapi import HTTPException, status


class EquipoNoEncontrado(HTTPException):
    def __init__(self, equipo_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el equipo con id {equipo_id}"
        )