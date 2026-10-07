import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from src.auth.dependencies import get_current_user
from src.config import CARPETA_UPLOADS

router = APIRouter(prefix="/uploads", tags=["evidencias"])

# Anclada al backend y no al CWD del proceso: antes, arrancar el server desde
# otra carpeta hacia que las evidencias se guardaran (y se sirvieran) en un
# lugar distinto al esperado.
CARPETA_BASE = CARPETA_UPLOADS.resolve()


def _resolver_ruta_segura(ruta_relativa: str) -> Path:
    """Convierte la ruta relativa guardada en una ruta absoluta dentro de uploads/.

    Si alguien intenta salir de la carpeta (por ejemplo '../../secretos.txt')
    se rechaza.
    """
    raiz = CARPETA_BASE
    ruta_absoluta = (raiz / ruta_relativa).resolve()

    # `is_relative_to` evita el Startswith sobre strings, que daba falsos
    # positivos con carpetas hermanas del tipo "uploads_secreto".
    if ruta_absoluta != raiz and not ruta_absoluta.is_relative_to(raiz):
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

    if not ruta.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe.",
        )

    tipo, _ = mimetypes.guess_type(str(ruta))

    return FileResponse(
        str(ruta),
        media_type=tipo or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=3600"},
    )