import logging
import os
import shutil
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form
from sqlalchemy.orm import Session

from src.database import get_db
from src.checklist import schemas, services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checklist", tags=["checklist"])

@router.get("/hoy", response_model=schemas.ChecklistResponse)
def obtener_checklist_hoy(
    equipo_id: int = Query(..., gt=0),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    logger.info(f"Consultando checklist para equipo {equipo_id} en fecha {fecha}")
    return services.obtener_o_crear_checklist(db, equipo_id, fecha)

@router.patch("/tarea/{tarea_id}", response_model=schemas.RegistroTareaResponse)
def marcar_tarea(
    tarea_id: int,
    completado: bool = Form(...),
    usuario_id: Optional[int] = Form(None), # Acá viaja el autor!
    evidencia: Optional[UploadFile] = File(None), # Acá viaja la foto!
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    ruta_evidencia = None
    
    # Si mandaron foto, la guardamos en la carpeta uploads
    if evidencia:
        upload_dir = "uploads/evidencias"
        os.makedirs(upload_dir, exist_ok=True)
        nombre_archivo = f"tarea_{tarea_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{evidencia.filename}"
        ruta_evidencia = os.path.join(upload_dir, nombre_archivo)
        
        with open(ruta_evidencia, "wb") as buffer:
            shutil.copyfileobj(evidencia.file, buffer)
            
    return services.marcar_tarea(db, tarea_id, completado, usuario_id, ruta_evidencia, fecha)