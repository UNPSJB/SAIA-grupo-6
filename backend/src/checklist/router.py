import logging
import os
import shutil
from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form
from sqlalchemy.orm import Session

from src.database import get_db
from src.auth.dependencies import get_current_user, require_operador
from src.checklist import schemas, services
from src.personal.models import Personal


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checklist", tags=["checklist"])

# Ver el checklist del día y el historial de una tarea: requiere poder operar.
_DEP_OPERAR = [Depends(require_operador)]

# Historial de checklists y consumo acumulado: solo quien administra.
_DEP_ADMIN = [Depends(require_operador)]


@router.get("/tareas-del-dia", response_model=schemas.TareasDelDiaResponse, dependencies=_DEP_OPERAR)
def listar_tareas_del_dia(

    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Lista plana de las tareas de todos los equipos activos para una fecha,
    con el nombre del plan al que pertenece cada una. Reemplaza el patrón de
    pedir /checklist/hoy una vez por equipo desde el frontend."""
    logger.info(f"Consultando tareas del día para fecha {fecha}")
    return services.listar_tareas_del_dia(db, fecha)


@router.get("/equipo/{equipo_id}", response_model=List[schemas.ChecklistResponse], dependencies=_DEP_OPERAR)
def obtener_checklists_del_equipo(
    equipo_id: int,
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Uno o varios checklists (uno por plan vigente) para un equipo/máquina
    en una fecha puntual."""
    return services.obtener_o_crear_checklists_del_dia(db, equipo_id, fecha)

@router.patch("/tarea/{tarea_id}", response_model=schemas.RegistroTareaResponse, dependencies=_DEP_OPERAR)
def marcar_tarea(
    tarea_id: int,
    completado: bool = Form(...),
    evidencia: Optional[UploadFile] = File(None),

    # NUEVOS CAMPOS PARA EL CONSUMO
    insumo_quimico_id: Optional[int] = Form(None),
    cantidad_consumida: Optional[float] = Form(None),
    elemento_limpieza_id: Optional[int] = Form(None),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    # La autoría se toma del token: nunca del cuerpo de la request, para que
    # no se pueda atribuir una tarea a otro usuario.
    current_user: Personal = Depends(require_operador),
):
    ruta_evidencia = None

    # Si mandaron foto, la guardamos en la carpeta uploads
    if evidencia:
        upload_dir = "uploads/evidencias"
        os.makedirs(upload_dir, exist_ok=True)

        nombre_archivo = (
            f"tarea_{tarea_id}_"
            f"{datetime.now().strftime('%Y%m%d%H%M%S')}_"
            f"{evidencia.filename}"
        )

        ruta_evidencia = os.path.join(
            upload_dir,
            nombre_archivo
        )

        with open(ruta_evidencia, "wb") as buffer:
            shutil.copyfileobj(
                evidencia.file,
                buffer
            )

    return services.marcar_tarea(
        db=db,
        tarea_id=tarea_id,
        completado=completado,
        usuario_id=current_user.id,
        evidencia_url=ruta_evidencia,
        fecha=fecha,
        insumo_quimico_id=insumo_quimico_id,
        cantidad_consumida=cantidad_consumida,
        elemento_limpieza_id=elemento_limpieza_id,
    )


@router.get("/registro/{registro_id}/historial", response_model=schemas.HistorialRegistroTareaResponse, dependencies=_DEP_OPERAR)
def obtener_historial_registro(registro_id: int, db: Session = Depends(get_db)):
    return services.obtener_historial_registro(db, registro_id)

@router.get("/historial", response_model=schemas.HistorialChecklistResponse, dependencies=_DEP_ADMIN)
def listar_historial_checklists(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    equipo_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Historial de checklists en un rango de fechas, con % de
    cumplimiento y detalle de tareas incumplidas (Historia #13)."""
    return services.listar_historial_checklists(db, fecha_desde, fecha_hasta, equipo_id)