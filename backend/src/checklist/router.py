import logging
from datetime import date
from typing import Optional, List, Literal, Union

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.common.archivos import guardar_archivo
from src.database import get_db
from src.auth.dependencies import require_operador, require_admin
from src.checklist import schemas, services
from src.tareas.models import Tarea
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
    # Validar existencia de tarea antes de guardar archivo
    tarea = db.get(Tarea, tarea_id)
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    ruta_evidencia = None
    if evidencia is not None and evidencia.filename:
        prefijo = f"tarea_{tarea_id}"
        ruta_evidencia = guardar_archivo(
            evidencia,
            EXTENSIONES_EVIDENCIA,
            TAMANO_MAX_EVIDENCIA,
            prefijo,
            "evidencias"
        )

    try:
        return services.marcar_tarea(
            db=db,
            tarea_id=tarea_id,
            completado=completado,
            usuario_id=current_user.id,
            usuario_nombre=f"{current_user.nombre} {current_user.apellido or ''}".strip(),
            evidencia_url=ruta_evidencia,
            fecha=fecha,
            insumo_quimico_id=insumo_quimico_id,
            cantidad_consumida=cantidad_consumida,
            elemento_limpieza_id=elemento_limpieza_id,
        )
    except Exception:
        # Eliminar archivo huérfano si el servicio falla
        if ruta_evidencia:
            from src.config import CARPETA_UPLOADS
            ruta_abs = CARPETA_UPLOADS / ruta_evidencia.removeprefix("uploads/")
            try:
                ruta_abs.unlink(missing_ok=True)
            except Exception:
                pass
        raise


@router.get("/registro/{registro_id}/historial", response_model=schemas.HistorialRegistroTareaResponse, dependencies=_DEP_OPERAR)
def obtener_historial_registro(registro_id: int, db: Session = Depends(get_db)):
    return services.obtener_historial_registro(db, registro_id)

@router.get(
    "/historial",
    response_model=Union[schemas.HistorialChecklistResponse, schemas.HistorialChecklistPagina],
    dependencies=_DEP_ADMIN,
)
def listar_historial_checklists(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    equipo_id: Optional[int] = Query(None),
    buscar: Optional[str] = Query(
        None,
        description="Búsqueda por nombre de equipo (ignora mayúsculas y tildes).",
    ),
    orden: Optional[Literal["fecha_asc", "fecha_desc", "equipo_asc", "equipo_desc"]] = Query(
        None, description="fecha_desc (default) | fecha_asc | equipo_asc | equipo_desc."
    ),
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve el historial completo del rango.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    """Historial de checklists en un rango de fechas, con % de
    cumplimiento y detalle de tareas incumplidas (Historia #13)."""
    return services.listar_historial_checklists(
        db, fecha_desde, fecha_hasta, equipo_id, buscar, orden, page, page_size
    )


@router.get(
    "/historial/{checklist_id}",
    response_model=schemas.DetalleChecklistResponse,
    dependencies=_DEP_ADMIN,
)
def obtener_detalle_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
):
    """Detalle de solo lectura de un checklist incluido en el historial."""
    return services.obtener_detalle_checklist(db, checklist_id)


@router.get("/consumo", response_model=schemas.ConsumoInsumosResponse, dependencies=_DEP_ADMIN)
def listar_consumo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: Session = Depends(get_db),
):
    """Consumo acumulado de productos de limpieza por producto y por fecha
    (Historia #10, criterio de aceptación 4)."""
    return services.listar_consumo_insumos(db, fecha_desde, fecha_hasta)
