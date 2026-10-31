from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin
from src.notificaciones import schemas, services

# Las alertas de recambio y vencimientos son parte de las historias de
# administración ("Como: persona con permiso de administrar").
router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"],
    dependencies=[Depends(require_admin)],
)

# Claves de orden que acepta el centro de notificaciones. `urgencia` es el
# default histórico (VENCIDOS arriba); el resto son las columnas que la tabla
# puede ordenar. Una clave desconocida es 422, no un orden distinto en
# silencio.
OrdenNotificacion = Literal[
    "urgencia",
    "estado_asc",
    "estado_desc",
    "vencimiento_asc",
    "vencimiento_desc",
    "origen_asc",
    "origen_desc",
]

UrgenciaNotificacion = Literal["todas", "vencidas", "proximas", "stock_bajo"]

OrigenNotificacion = Literal[
    "todas",
    "ELEMENTO_LIMPIEZA",
    "VENCIMIENTO_PERSONAL",
    "PLAN_CALIBRACION",
    "PLAN_MANTENIMIENTO",
    "STOCK_BAJO",
]


@router.get("", response_model=Union[List[schemas.NotificacionResponse], schemas.NotificacionPagina])
def listar_notificaciones(
    buscar: Optional[str] = Query(
        None, description="Búsqueda en título y mensaje (ignora mayúsculas y tildes)."
    ),
    urgencia: Optional[UrgenciaNotificacion] = Query(
        None, description="'todas' | 'vencidas' | 'proximas' | 'stock_bajo'."
    ),
    origen: Optional[OrigenNotificacion] = Query(
        None,
        description="'todas' o el tipo de alerta, incluido STOCK_BAJO.",
    ),
    orden: Optional[OrdenNotificacion] = Query(
        None,
        description="urgencia (default) | estado_asc/desc | vencimiento_asc/desc | origen_asc/desc.",
    ),
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usa la campana del navbar).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        # `buscar` también aplica sin `page` (la campana no lo manda, pero el
        # contrato del endpoint tiene que ser el mismo en ambos caminos).
        return services.obtener_todas_notificaciones(db, buscar)
    items, total, contadores = services.obtener_notificaciones_paginadas(
        db, buscar, urgencia, origen, orden, page, page_size
    )
    return schemas.NotificacionPagina(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        contadores=contadores,
    )


@router.get("/configuracion", response_model=schemas.ConfiguracionAlertasResponse)
def obtener_configuracion(db: Session = Depends(get_db)):
    return schemas.ConfiguracionAlertasResponse(
        dias_alerta_vencimiento_personal=services.obtener_dias_alerta_vencimiento_personal(db)
    )


@router.put("/configuracion", response_model=schemas.ConfiguracionAlertasResponse)
def actualizar_configuracion(
    datos: schemas.ConfiguracionAlertasUpdate, db: Session = Depends(get_db)
):
    dias = services.actualizar_dias_alerta_vencimiento_personal(
        db, datos.dias_alerta_vencimiento_personal
    )
    return schemas.ConfiguracionAlertasResponse(dias_alerta_vencimiento_personal=dias)
