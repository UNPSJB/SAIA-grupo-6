from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.vencimientos import schemas, services

# La vista consolidada es de la persona con permiso de administrar.
router = APIRouter(
    prefix="/vencimientos",
    tags=["Vencimientos"],
    dependencies=[Depends(require_admin)],
)

# Claves de orden que acepta el listado. `URGENCIA` es el default histórico y
# `VIGENTES_PRIMERO` su inverso; el resto son las columnas clickeables de la
# tabla. Una clave desconocida es 422, no un orden silenciosamente distinto.
OrdenVencimiento = Literal[
    "URGENCIA",
    "VIGENTES_PRIMERO",
    "estado_asc",
    "estado_desc",
    "tipo_asc",
    "tipo_desc",
    "vencimiento_asc",
    "vencimiento_desc",
]

EstadoVencimiento = Literal["VENCIDO", "PROXIMO", "VIGENTE"]


@router.get("", response_model=List[schemas.VencimientoConsolidadoResponse])
def listar_vencimientos(
    tipo: Optional[Literal["PERSONAL", "CALIBRACION", "MANTENIMIENTO", "DOCUMENTO"]] = Query(None),
    db: Session = Depends(get_db),
):
    return services.listar_vencimientos(db, tipo)


@router.get("/opciones", response_model=schemas.VencimientosOpcionesResponse)
def listar_opciones_vencimientos(db: Session = Depends(get_db)):
    """Personas y aptitudes con vencimientos activos, para los dropdowns de
    filtro de la tabla (reemplaza derivarlos de la lista completa)."""
    return services.listar_opciones_vencimientos(db)


@router.get(
    "/pagina",
    response_model=schemas.VencimientoPagina,
)
def listar_vencimientos_paginado(
    tipo: Optional[Literal["PERSONAL", "CALIBRACION", "MANTENIMIENTO", "DOCUMENTO"]] = Query(None),
    persona_id: Optional[int] = Query(None, description="Solo vencimientos de esa persona."),
    aptitud: Optional[str] = Query(None, description="Solo la aptitud (detalle) indicada."),
    estado: Optional[EstadoVencimiento] = Query(
        None, description="Solo los vencimientos en ese estado (VENCIDO, PROXIMO o VIGENTE)."
    ),
    buscar: Optional[str] = Query(
        None, description="Búsqueda en detalle, sujeto, tipo, estado y fecha (ignora tildes)."
    ),
    orden: Optional[OrdenVencimiento] = Query(
        None,
        description=(
            "URGENCIA (default) | VIGENTES_PRIMERO | estado, tipo o "
            "vencimiento con dirección _asc/_desc."
        ),
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    """Listado consolidado paginado, con los filtros aplicados en el servidor."""
    items, total = services.listar_vencimientos_paginado(
        db, tipo, persona_id, aptitud, estado, buscar, orden, page, page_size
    )
    return schemas.VencimientoPagina(
        items=items, total=total, page=page, page_size=page_size
    )