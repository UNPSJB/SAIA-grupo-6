import logging
import mimetypes
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from src.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["evidencias"])

CARPETA_BASE = os.path.abspath("uploads")


def _resolver_ruta_segura(ruta_relativa: str) -> str:
    """Convierte la ruta relativa guardada en una ruta absoluta dentro de uploads/.

    Si alguien intenta salir de la carpeta (por ejemplo '../../secretos.txt')
    se rechaza.
    """
    ruta_absoluta = os.path.abspath(os.path.join(CARPETA_BASE, ruta_relativa))

    if not ruta_absoluta.startswith(CARPETA_BASE + os.sep) and ruta_absoluta != CARPETA_BASE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ruta de archivo inválida.",
        )

    return ruta_absoluta


@router.get("/{ruta_relativa:path}")
def obtener_evidencia(
    ruta_relativa: str,
    current_user=Depends(get_current_user),
):
    """Sirve una evidencia (foto de una tarea) exigiendo sesión.

    Antes la carpeta `uploads` estaba montada como estática y cualquiera que
    conociera la URL veía las fotos sin autenticarse.
    """
    ruta = _resolver_ruta_segura(ruta_relativa)

    if not os.path.isfile(ruta):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe.",
        )

    tipo, _ = mimetypes.guess_type(ruta)

    return FileResponse(
        ruta,
        media_type=tipo or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=3600"},
    )