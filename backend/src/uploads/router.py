import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user_activo_completo
from src.config import CARPETA_UPLOADS
from src.database import get_db
from src.certificaciones_transportista.models import CertificacionTransportista
from src.checklist.models import HistorialRegistroTarea, RegistroTarea
from src.documentos.models import VersionDocumento
from src.Equipo.models import Calibracion
from src.incidente.models import Incidente
from src.planes_accion.models import EvidenciaPlan
from src.proveedores.models import CertificacionProveedor

router = APIRouter(prefix="/uploads", tags=["evidencias"])

# Anclada al backend y no al CWD del proceso: antes, arrancar el server desde
# otra carpeta hacia que las evidencias se guardaran (y se sirvieran) en un
# lugar distinto al esperado.
CARPETA_BASE = CARPETA_UPLOADS.resolve()


# Columnas que guardan la ruta (`uploads/...`) de un archivo subido. Un archivo
# se sirve solo si alguna fila de la sede del usuario lo referencia: las
# consultas ya vienen filtradas por sede (src.establecimientos.contexto), así
# que el archivo de otra sede "no existe" aunque se conozca la ruta.
REFERENCIAS_A_ARCHIVOS = (
    VersionDocumento.archivo_url,
    Calibracion.certificado_url,
    CertificacionTransportista.archivo_url,
    CertificacionProveedor.archivo_url,
    RegistroTarea.evidencia_url,
    HistorialRegistroTarea.evidencia_url,
    Incidente.foto_url,
    EvidenciaPlan.archivo_url,
)


def _referenciado_en_la_sede(db: Session, ruta_para_bd: str) -> bool:
    return any(
        # `select(...).exists()` y no `exists().where(...)`: este último no
        # recibe el filtro de sede (ver src.establecimientos.contexto).
        db.scalar(select(select(columna).where(columna == ruta_para_bd).exists()))
        for columna in REFERENCIAS_A_ARCHIVOS
    )


def _resolver_ruta_segura(ruta_relativa: str) -> Path:
    """Convierte la ruta relativa guardada en una ruta absoluta dentro de uploads/.

    Si alguien intenta salir de la carpeta (por ejemplo '../../secretos.txt')
    se rechaza.
    """
    raiz = CARPETA_BASE
    try:
        ruta_absoluta = (raiz / ruta_relativa).resolve()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ruta de archivo inválida.",
        )

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
    current_user=Depends(get_current_user_activo_completo),
    db: Session = Depends(get_db),
):
    """Sirve una evidencia (foto de una tarea) exigiendo sesión.

    Antes la carpeta `uploads` estaba montada como estática y cualquiera que
    conociera la URL veía las fotos sin autenticarse.
    """
    # Primero resolvemos la ruta de forma segura: rechaza path traversal y
    # normaliza (resuelve .., %, etc.) antes de tomar cualquier decisión de
    # autorización, para que no se pueda saltar el control de documentos.
    ruta_absoluta = _resolver_ruta_segura(ruta_relativa)
    ruta_relativa_norm = ruta_absoluta.relative_to(CARPETA_BASE).as_posix()
    partes = ruta_relativa_norm.split("/")

    # Restricción para documentos: control de versiones archivadas.
    # Se decide sobre la ruta normalizada (primer segmento en minúsculas, por
    # Windows) y se busca la versión en la BD con la ruta `uploads/<ruta>`.
    if partes and partes[0].lower() == "documentos":
        ruta_para_bd = f"uploads/{ruta_relativa_norm}"
        version = db.query(VersionDocumento).filter(
            VersionDocumento.archivo_url == ruta_para_bd
        ).first()

        if not version:
            # Archivo no corresponde a ninguna versión conocida: no revelar existencia
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El archivo no existe.",
            )

        # Versión archivada: solo admin
        if not version.vigente:
            if not (current_user.puede_administrar or current_user.es_super_admin):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tenés permiso para acceder a versiones archivadas.",
                )
        else:
            # Versión vigente: requiere permiso de operar
            if not (current_user.puede_operar or current_user.puede_administrar):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Se requiere permiso de operar para acceder a documentos.",
                )

    # Todo archivo (no solo los documentos) tiene que pertenecer a la sede de
    # quien lo pide. Sin referencia en su sede: 404, sin revelar si existe.
    if not _referenciado_en_la_sede(db, f"uploads/{ruta_relativa_norm}"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe.",
        )

    ruta = ruta_absoluta

    if not ruta.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe.",
        )

    tipo, _ = mimetypes.guess_type(str(ruta))

    return FileResponse(
        str(ruta),
        media_type=tipo or "application/octet-stream",
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )