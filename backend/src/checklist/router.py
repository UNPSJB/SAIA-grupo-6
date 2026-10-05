import logging
import os
from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session
from werkzeug.utils import secure_filename

from src.database import get_db
from src.auth.dependencies import get_current_user, require_operador, require_admin
from src.checklist import schemas, services
from src.personal.models import Personal


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/checklist", tags=["checklist"])

# Ver el checklist del día y el historial de una tarea: requiere poder operar
# (HU "Ver checklist del día", "Marcar tarea con evidencia", "Registrar autoría").
_DEP_OPERAR = [Depends(require_operador)]

# Historial de checklists y consumo acumulado: solo quien administra
# (HU "Consultar historial de checklists" y "Registrar consumo de productos").
_DEP_ADMIN = [Depends(require_admin)]

# Extensiones y tamaño máximo permitido para la evidencia fotográfica.
EXTENSIONES_EVIDENCIA = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX_EVIDENCIA = 5 * 1024 * 1024  # 5 MB


def _guardar_evidencia(evidencia: Optional[UploadFile], tarea_id: int) -> Optional[str]:
    """Guarda la foto de evidencia y devuelve su ruta relativa.

    Sanea el nombre del archivo (evita path traversal) y valida extensión
    y tamaño antes de escribir en disco.
    """
    if evidencia is None or not evidencia.filename:
        return None

    extension = os.path.splitext(evidencia.filename)[1].lower()

    if extension not in EXTENSIONES_EVIDENCIA:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de imagen no permitido ({extension or 'sin extensión'}). "
                   f"Formatos válidos: {', '.join(sorted(EXTENSIONES_EVIDENCIA))}.",
        )

    contenido = evidencia.file.read()
    evidencia.file.seek(0)

    if len(contenido) > TAMANO_MAX_EVIDENCIA:
        raise HTTPException(
            status_code=400,
            detail=f"La evidencia supera el máximo de "
                   f"{TAMANO_MAX_EVIDENCIA // (1024 * 1024)} MB.",
        )

    upload_dir = "uploads/evidencias"
    os.makedirs(upload_dir, exist_ok=True)

    # secure_filename elimina rutas y caracteres peligrosos del nombre original
    nombre_seguro = secure_filename(evidencia.filename) or "evidencia"
    nombre_archivo = (
        f"tarea_{tarea_id}_"
        f"{datetime.now().strftime('%Y%m%d%H%M%S')}_"
        f"{nombre_seguro}"
    )

    # Guardamos la ruta con "/" (no os.sep) para que sea la misma en la base y
    # en la URL, sin importar el sistema operativo donde corre el backend.
    ruta_evidencia = f"{upload_dir}/{nombre_archivo}"
    ruta_absoluta = os.path.join(upload_dir, nombre_archivo)

    with open(ruta_absoluta, "wb") as buffer:
        buffer.write(contenido)

    return ruta_evidencia


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
    cantidad_consumida: Optional[float] = Form(None, gt=0),
    elemento_limpieza_id: Optional[int] = Form(None),
    fecha: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    # La autoría se toma del token: nunca del cuerpo de la request, para que
    # no se pueda atribuir una tarea a otro usuario (HU "Registrar autoría").
    current_user: Personal = Depends(require_operador),
):
    ruta_evidencia = _guardar_evidencia(evidencia, tarea_id)

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


@router.get("/consumo", response_model=schemas.ConsumoInsumosResponse, dependencies=_DEP_ADMIN)
def listar_consumo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: Session = Depends(get_db),
):
    """Consumo acumulado de productos de limpieza por producto y por fecha
    (Historia #10, criterio de aceptación 4)."""
    return services.listar_consumo_insumos(db, fecha_desde, fecha_hasta)
