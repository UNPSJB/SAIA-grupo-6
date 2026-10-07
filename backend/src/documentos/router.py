import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.documentos import schemas, services
from src.documentos.constants import TipoDocumento

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documentos", tags=["documentos"])

# Los endpoints de documentos siguen el estándar del resto del proyecto:
# - Lectura (GET) -> require_operador (operadores y admins consultan)
# - Escritura (POST) -> require_admin (solo admins gestionan documentos)
_DEP_OPERADOR = [Depends(require_operador)]
_DEP_ADMIN = [Depends(require_admin)]


# Va ANTES de "/{documento_id}" para que "vigentes" no se confunda con un id.
@router.get(
    "/vigentes",
    response_model=list[schemas.DocumentoVigente],
    dependencies=_DEP_OPERADOR,
)
def read_documentos_vigentes(
    buscar: Optional[str] = Query(None),
    tipo: Optional[TipoDocumento] = Query(None),
    db: Session = Depends(get_db),
):
    return services.listar_documentos_vigentes(db, buscar, tipo)


@router.post("", response_model=schemas.Documento, dependencies=_DEP_ADMIN)
def create_documento(
    nombre: str = Form(...),
    tipo: TipoDocumento = Form(...),
    autor_id: int = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    logger.info("Alta de documento '%s'", nombre)
    return services.crear_documento(db, nombre, tipo, autor_id, archivo)


@router.post(
    "/{documento_id}/versiones",
    response_model=schemas.Documento,
    dependencies=_DEP_ADMIN,
)
def create_version(
    documento_id: int,
    autor_id: int = Form(...),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    logger.info("Nueva versión para el documento %s", documento_id)
    return services.subir_nueva_version(db, documento_id, autor_id, archivo)


# No existen PUT/PATCH/DELETE sobre versiones: las versiones anteriores son inmutables.
@router.get(
    "/{documento_id}/historial",
    response_model=schemas.HistorialDocumento,
    dependencies=_DEP_OPERADOR,
)
def read_historial(
    documento_id: int,
    usuario_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return services.obtener_historial(db, documento_id, usuario_id)


# ---------- Gestión (administrador) ----------
@router.get("", response_model=list[schemas.Documento], dependencies=_DEP_ADMIN)
def read_documentos(db: Session = Depends(get_db)):
    return services.listar_documentos(db)


@router.get(
    "/{documento_id}",
    response_model=schemas.Documento,
    dependencies=_DEP_ADMIN,
)
def read_documento(documento_id: int, db: Session = Depends(get_db)):
    return services.leer_documento(db, documento_id)
