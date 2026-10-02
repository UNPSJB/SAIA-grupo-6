import logging
import os
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from src.database import get_db
from src.incidente import schemas, services
from src.incidente.constants import TipoIncidente

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incidentes", tags=["Incidentes"])


@router.post("", response_model=schemas.IncidenteResponse)
def crear_incidente(
    descripcion: str = Form(...),
    tipo: TipoIncidente = Form(...),
    equipo_id: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None),
    usuario_id: int = Form(...),
    db: Session = Depends(get_db),
):
    ruta_foto = None

    if foto:
        upload_dir = "uploads/incidentes"
        os.makedirs(upload_dir, exist_ok=True)

        nombre_archivo = (
            f"incidente_{datetime.now().strftime('%Y%m%d%H%M%S')}_"
            f"{foto.filename}"
        )

        ruta_foto = os.path.join(upload_dir, nombre_archivo)

        with open(ruta_foto, "wb") as buffer:
            shutil.copyfileobj(foto.file, buffer)

    datos = schemas.IncidenteCreate(
        descripcion=descripcion,
        tipo=tipo,
        equipo_id=equipo_id,
        foto_url=ruta_foto,
        usuario_id=usuario_id,
    )

    return services.crear_incidente(db, datos)


@router.get("", response_model=List[schemas.IncidenteResponse])
def listar_incidentes(
    incluir_inactivos: bool = False,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return services.listar_incidentes(db, incluir_inactivos, tipo, equipo_id)


@router.get("/{incidente_id}", response_model=schemas.IncidenteResponse)
def obtener_incidente(incidente_id: int, db: Session = Depends(get_db)):
    return services.obtener_incidente(db, incidente_id)


@router.delete("/{incidente_id}", response_model=schemas.IncidenteResponse)
def eliminar_incidente(incidente_id: int, db: Session = Depends(get_db)):
    return services.eliminar_incidente(db, incidente_id)
