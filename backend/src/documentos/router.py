import logging
from typing import Literal, Optional, Union
from datetime import date
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.documentos import schemas, services
from src.documentos.constants import EstadoDocumentoFiltro, TipoDocumento
from src.personal.models import Personal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documentos", tags=["documentos"])

_DEP_OPERADOR = [Depends(require_operador)]
_DEP_ADMIN = [Depends(require_admin)]

OrdenDocumentoVigente = Literal[
    "nombre_asc",
    "nombre_desc",
    "tipo_asc",
    "tipo_desc",
    "vencimiento_asc",
    "vencimiento_desc",
]

OrdenDocumento = Literal[
    "nombre_asc",
    "nombre_desc",
    "tipo_asc",
    "tipo_desc",
    "estado_asc",
    "estado_desc",
]


# Va ANTES de "/{documento_id}" para que "vigentes" no se confunda con un id.
@router.get(
    "/vigentes",
    response_model=Union[list[schemas.DocumentoVigente], schemas.DocumentoVigentePagina],
    dependencies=_DEP_OPERADOR,
)
def read_documentos_vigentes(
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en el nombre y el tipo (sin distinguir mayúsculas ni tildes).",
    ),
    tipo: Optional[TipoDocumento] = Query(None),
    estado: Optional[EstadoDocumentoFiltro] = Query(
        None,
        description=(
            "'vigente' (sin fecha o vence hoy o después) o 'vencido' "
            "(fecha de vencimiento anterior a hoy). Sin el parámetro, todos."
        ),
    ),
    orden: OrdenDocumentoVigente = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_documentos_vigentes(db, buscar, tipo, orden, estado)
    items, total = services.listar_documentos_vigentes_paginado(
        db, buscar, tipo, page, page_size, orden, estado
    )
    return schemas.DocumentoVigentePagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.post("", response_model=schemas.Documento, dependencies=_DEP_ADMIN)
def create_documento(
    nombre: str = Form(...),
    tipo: TipoDocumento = Form(...),
    autor_id: int = Form(...),
    archivo: UploadFile = File(...),
    fecha_vencimiento: Optional[date] = Form(None),
    db: Session = Depends(get_db),
):
    logger.info("Alta de documento '%s'", nombre)
    return services.crear_documento(
        db,
        nombre,
        tipo,
        autor_id,
        archivo,
        fecha_vencimiento,
    )

@router.post(
    "/{documento_id}/versiones",
    response_model=schemas.Documento,
    dependencies=_DEP_ADMIN,
)
def create_version(
    documento_id: int,
    autor_id: int = Form(...),
    archivo: UploadFile = File(...),
    fecha_vencimiento: Optional[date] = Form(None),
    db: Session = Depends(get_db),
):
    logger.info("Nueva versión para el documento %s", documento_id)
    return services.subir_nueva_version(
        db,
        documento_id,
        autor_id,
        archivo,
        fecha_vencimiento,
    )

# No existen PUT/PATCH/DELETE sobre versiones: las versiones anteriores son inmutables.
@router.get(
    "/{documento_id}/historial",
    response_model=schemas.HistorialDocumento,
)
def read_historial(
    documento_id: int,
    # El permiso se verifica contra el usuario del TOKEN, no contra un
    # parámetro del cliente: con `usuario_id` en el query, cualquier operador
    # pasaba el id de un administrador y veía el historial de cualquier documento.
    current_user: Personal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return services.obtener_historial(db, documento_id, current_user.id)


# ---------- Gestión (administrador) ----------
@router.get("", response_model=Union[list[schemas.Documento], schemas.DocumentoPagina], dependencies=_DEP_ADMIN)
def read_documentos(
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en el nombre y el tipo (sin distinguir mayúsculas ni tildes).",
    ),
    tipo: Optional[TipoDocumento] = Query(None),
    estado: Optional[EstadoDocumentoFiltro] = Query(
        None,
        description=(
            "'vigente' (sin fecha o vence hoy o después) o 'vencido' "
            "(fecha de vencimiento anterior a hoy). Sin el parámetro, todos."
        ),
    ),
    orden: OrdenDocumento = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_documentos(db, buscar, tipo, orden, estado)
    items, total = services.listar_documentos_paginado(
        db, page, page_size, buscar, tipo, orden, estado
    )
    return schemas.DocumentoPagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/{documento_id}",
    response_model=schemas.Documento,
    dependencies=_DEP_ADMIN,
)
def read_documento(documento_id: int, db: Session = Depends(get_db)):
    return services.leer_documento(db, documento_id)
