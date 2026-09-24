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


@router.get("/tareas-del-dia", response_model=schemas.TareasDelDiaResponse)
def listar_tareas_del_dia(

    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Lista plana de las tareas de todos los equipos activos para una fecha,
    con el nombre del plan al que pertenece cada una. Reemplaza el patrón de
    pedir /checklist/hoy una vez por equipo desde el frontend."""
    logger.info(f"Consultando tareas del día para fecha {fecha}")
    return services.listar_tareas_del_dia(db, fecha)

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

@router.get("/registro/{registro_id}/historial", response_model=schemas.HistorialRegistroTareaResponse)
def obtener_historial_registro(registro_id: int, db: Session = Depends(get_db)):
    return services.obtener_historial_registro(db, registro_id)