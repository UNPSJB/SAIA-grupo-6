import mimetypes
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user_activo_completo, require_admin
from src.certificaciones_transportista import schemas, services
from src.database import get_db

router = APIRouter(
    prefix="/transportistas",
    tags=["Transportistas - Certificaciones"],
)


@router.post(
    "/{transportista_id}/certificaciones",
    response_model=schemas.CertificacionTransportistaResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def cargar_certificacion(
    transportista_id: int,
    tipo: str = Form(...),
    numero: str = Form(...),
    # Tipadas como `date`: si la fecha llega mal, FastAPI responde 422 en vez
    # de reventar con un 500 al parsearla a mano.
    fecha_emision: date = Form(...),
    fecha_vencimiento: date = Form(...),
    observaciones: Optional[str] = Form(None),
    archivo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    datos = schemas.CertificacionTransportistaCreate(
        tipo=tipo,
        numero=numero,
        fecha_emision=fecha_emision,
        fecha_vencimiento=fecha_vencimiento,
        observaciones=observaciones,
    )
    return services.crear_certificacion(db, transportista_id, datos, archivo)


@router.get(
    "/{transportista_id}/certificaciones",
    response_model=list[schemas.CertificacionTransportistaResponse],
    dependencies=[Depends(get_current_user_activo_completo)],
)
def listar_certificaciones(
    transportista_id: int,
    incluir_historial: bool = False,
    db: Session = Depends(get_db),
):
    return services.listar_certificaciones(db, transportista_id, incluir_historial)


@router.get(
    "/certificaciones/{certificacion_id}/archivo",
    dependencies=[Depends(get_current_user_activo_completo)],
)
def descargar_archivo_certificacion(
    certificacion_id: int,
    db: Session = Depends(get_db),
):
    certificacion = services.obtener_certificacion(db, certificacion_id)
    ruta = services.obtener_ruta_archivo(certificacion)

    if ruta is None or not ruta.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo adjunto no existe.",
        )

    tipo, _ = mimetypes.guess_type(str(ruta))

    return FileResponse(
        str(ruta),
        media_type=tipo or "application/octet-stream",
        filename=ruta.name,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put(
    "/certificaciones/{certificacion_id}",
    response_model=schemas.CertificacionTransportistaResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_certificacion(
    certificacion_id: int,
    datos: schemas.CertificacionTransportistaUpdate,
    db: Session = Depends(get_db),
):
    """Solo observaciones. Tipo y fechas son inmutables."""
    return services.actualizar_certificacion(db, certificacion_id, datos)


@router.put(
    "/certificaciones/{certificacion_id}/archivo",
    response_model=schemas.CertificacionTransportistaResponse,
    dependencies=[Depends(require_admin)],
)
def reemplazar_archivo_certificacion(
    certificacion_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return services.actualizar_certificacion(
        db,
        certificacion_id,
        schemas.CertificacionTransportistaUpdate(),
        archivo,
    )


@router.post(
    "/certificaciones/{certificacion_id}/anular",
    response_model=schemas.CertificacionTransportistaResponse,
    dependencies=[Depends(require_admin)],
)
def anular_certificacion(
    certificacion_id: int,
    datos: schemas.CertificacionTransportistaAnular,
    db: Session = Depends(get_db),
):
    return services.anular_certificacion(db, certificacion_id, datos)
