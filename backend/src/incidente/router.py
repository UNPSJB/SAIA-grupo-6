from datetime import date
from typing import List, Literal, Optional, Union
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.common.archivos import guardar_archivo
from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.incidente import schemas, services
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.personal.models import Personal


router = APIRouter(prefix="/incidentes", tags=["Incidentes"])

# Claves de orden que acepta la tabla de gestión. `recientes`/`antiguos` se
# conservan como alias de fecha: el verifier y los consumidores viejos los
# siguen mandando. Una clave desconocida es 422 (Literal), no un orden
# silenciosamente distinto.
OrdenIncidente = Literal[
    "recientes",
    "antiguos",
    "fecha_asc",
    "fecha_desc",
    "estado_asc",
    "estado_desc",
    "tipo_asc",
    "tipo_desc",
]

# Formatos y tamaño máximo de la foto del incidente. Mismo criterio que las
# evidencias del checklist: el MIME que manda el navegador no alcanza, el
# archivo se valida acá.
EXTENSIONES_FOTO = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX_FOTO = 5 * 1024 * 1024  # 5 MB



@router.post("", response_model=schemas.IncidenteResponse)
def crear_incidente(
    titulo: str = Form(...),
    descripcion: str = Form(...),
    tipo: TipoIncidente = Form(...),
    equipo_id: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None),
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    ruta_foto = None
    if foto is not None and foto.filename:
        # Validar equipo si se indica para guardar archivo solo después de validar
        if equipo_id is not None:
            from src.Equipo.models import Equipo
            if db.get(Equipo, equipo_id) is None:
                raise HTTPException(status_code=404, detail="Equipo no encontrado")
        prefijo = "incidente"
        ruta_foto = guardar_archivo(
            foto,
            EXTENSIONES_FOTO,
            TAMANO_MAX_FOTO,
            prefijo,
            "incidentes"
        )

    datos = schemas.IncidenteCreate(
        titulo=titulo,
        descripcion=descripcion,
        tipo=tipo,
        equipo_id=equipo_id,
        foto_url=ruta_foto,
    )

    try:
        incidente = services.crear_incidente(db, datos, current_user.id)
        return incidente
    except Exception:
        if ruta_foto:
            from src.config import CARPETA_UPLOADS
            ruta_abs = CARPETA_UPLOADS / ruta_foto.removeprefix("uploads/")
            try:
                ruta_abs.unlink(missing_ok=True)
            except Exception:
                pass
        raise


@router.get("", response_model=Union[List[schemas.IncidenteResponse], schemas.IncidentePagina])
def listar_incidentes(
    estado: Optional[EstadoIncidente] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    buscar: Optional[str] = Query(
        None,
        description="Búsqueda insensible a mayúsculas y tildes en título, descripción y quien reportó.",
    ),
    orden: Optional[OrdenIncidente] = Query(
        None,
        description=(
            "Orden del listado. 'recientes'/'antiguos' (alias de fecha) o "
            "una columna con dirección: fecha, estado o tipo."
        ),
    ),
    fecha_desde: Optional[date] = Query(
        None,
        description="Fecha desde para acotar el listado (inclusive).",
    ),
    fecha_hasta: Optional[date] = Query(
        None,
        description="Fecha hasta para acotar el listado (inclusive).",
    ),
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usa el tablero).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    current_user: Personal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Listado de incidentes. Sin `estado` devuelve abiertos y cerrados."""
    if page is None:
        # `buscar` también aplica sin `page`: antes se descartaba en silencio
        # y el cliente recibía la lista completa sin filtrar.
        return services.listar_incidentes(
            db,
            estado,
            tipo,
            equipo_id,
            orden=orden,
            buscar=buscar,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
        )
    items, total = services.listar_incidentes_paginado(
        db,
        estado,
        tipo,
        equipo_id,
        buscar,
        orden,
        page,
        page_size,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )
    return schemas.IncidentePagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/mios", response_model=Union[List[schemas.IncidenteResponse], schemas.IncidentePagina])
def listar_mis_incidentes(
    estado: Optional[EstadoIncidente] = Query(
        None,
        description="Filtra por estado. Sin este parámetro devuelve abiertos y cerrados.",
    ),
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa.",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    """Endpoint para que operadores vean sus propios incidentes reportados.

    El orden es siempre "más recientes primero": esta vista no expone `orden`.
    """
    if page is None:
        return services.listar_mis_incidentes(db, current_user.id, estado)
    items, total = services.listar_mis_incidentes_paginado(
        db, current_user.id, page, page_size, estado
    )
    return schemas.IncidentePagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/resumen-por-tipo", response_model=schemas.IncidenteResumenResponse)
def resumen_incidentes_por_tipo(
    incluir_cerrados: bool = False,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    current_user: Personal = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Indicador "incidentes por tipo" del tablero (E7).

    Por defecto cuenta solo los incidentes sin acción correctiva registrada
    (abiertos). Con `incluir_cerrados=true` cuenta el histórico completo.
    `fecha_desde`/`fecha_hasta` acotan por fecha de reporte (inclusive).

    Se declara ANTES de `/{incidente_id}`: si no, FastAPI intentaría parsear
    "resumen-por-tipo" como id numérico y devolvería 422.
    """
    estado = None if incluir_cerrados else EstadoIncidente.ABIERTO
    return services.resumen_por_tipo(db, estado, fecha_desde, fecha_hasta)


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


@router.get("/{incidente_id}/historial", response_model=schemas.HistorialIncidenteResponse)
def obtener_historial_incidente(
    incidente_id: int,
    current_user: Personal = Depends(require_operador),
    db: Session = Depends(get_db),
):
    """Obtiene el historial de cierre/reapertura de un incidente."""
    return services.obtener_historial_incidente(db, incidente_id, current_user)
