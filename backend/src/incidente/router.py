import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.incidente import schemas, services
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.personal.models import Personal


router = APIRouter(prefix="/incidentes", tags=["Incidentes"])

# Formatos y tamaño máximo de la foto del incidente. Mismo criterio que las
# evidencias del checklist: el MIME que manda el navegador no alcanza, el
# archivo se valida acá.
EXTENSIONES_FOTO = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX_FOTO = 5 * 1024 * 1024  # 5 MB


def _guardar_foto(foto: Optional[UploadFile]) -> Optional[str]:
    """Guarda la foto del incidente y devuelve su ruta relativa.

    Sanea el nombre del archivo (evita path traversal) y valida extensión y
    tamaño antes de escribir en disco.
    """
    if foto is None or not foto.filename:
        return None

    extension = os.path.splitext(foto.filename)[1].lower()
    if extension not in EXTENSIONES_FOTO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Formato de imagen no permitido ({extension or 'sin extensión'}). "
                f"Formatos válidos: {', '.join(sorted(EXTENSIONES_FOTO))}."
            ),
        )

    contenido = foto.file.read()
    foto.file.seek(0)

    if len(contenido) > TAMANO_MAX_FOTO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "La foto supera el máximo de "
                f"{TAMANO_MAX_FOTO // (1024 * 1024)} MB."
            ),
        )

    # secure_filename elimina rutas y caracteres peligrosos del nombre original.
    nombre_seguro = secure_filename(foto.filename)

    # secure_filename puede quedarse sin extensión (ej. "foto.jpg" -> "jpg") y
    # no recorta: se rehace el nombre con la extensión ya validada y un largo
    # razonable, porque un nombre gigante hace fallar el open() con 500.
    base = os.path.splitext(nombre_seguro)[0] or "foto"
    base = base[:120]

    nombre_archivo = f"incidente_{datetime.now().strftime('%Y%m%d%H%M%S')}_{base}{extension}"

    upload_dir = "uploads/incidentes"
    os.makedirs(upload_dir, exist_ok=True)

    # La ruta se guarda con "/" para que sea la misma en la base y en la URL.
    ruta_relativa = f"uploads/incidentes/{nombre_archivo}"

    with open(os.path.join(upload_dir, nombre_archivo), "wb") as buffer:
        buffer.write(contenido)

    return ruta_relativa


@router.post("", response_model=schemas.IncidenteResponse)
def crear_incidente(
    descripcion: str = Form(...),
    tipo: TipoIncidente = Form(...),
    equipo_id: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None),
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    ruta_foto = _guardar_foto(foto)

    datos = schemas.IncidenteCreate(
        descripcion=descripcion,
        tipo=tipo,
        equipo_id=equipo_id,
        foto_url=ruta_foto,
    )

    # Crear incidente a través del service
    incidente = services.crear_incidente(db, datos, current_user.id)
    return incidente


@router.get("", response_model=List[schemas.IncidenteResponse])
def listar_incidentes(
    estado: Optional[EstadoIncidente] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    current_user: Personal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Listado de incidentes. Sin `estado` devuelve abiertos y cerrados."""
    return services.listar_incidentes(db, estado, tipo, equipo_id)


@router.get("/mios", response_model=List[schemas.IncidenteResponse])
def listar_mis_incidentes(
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    """Endpoint para que operadores vean sus propios incidentes reportados."""
    return services.listar_mis_incidentes(db, current_user.id)


@router.get("/{incidente_id}", response_model=schemas.IncidenteResponse)
def obtener_incidente(
    incidente_id: int,
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    return services.obtener_incidente(db, incidente_id, current_user)


@router.patch("/{incidente_id}/estado", response_model=schemas.IncidenteResponse)
def cambiar_estado_incidente(
    incidente_id: int,
    datos: schemas.IncidenteEstadoUpdate,
    current_user: Personal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Cierra o reabre un incidente, dejando asentada la acción correctiva.

    Cerrar es la acción de la historia: el incidente queda en estado cerrado
    con fecha de cierre y responsable de la resolución.
    """
    return services.cambiar_estado_incidente(
        db,
        incidente_id,
        datos.estado,
        current_user,
        datos.observacion_cierre,
    )