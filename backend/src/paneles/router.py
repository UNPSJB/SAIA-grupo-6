from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.incidente.constants import TipoIncidente
from src.paneles import schemas, services
from src.personal.models import Personal

router = APIRouter(prefix="/paneles", tags=["Paneles de categoría"])


def _periodo(
    desde: date = Query(..., description="Primer día del período (inclusive)."),
    hasta: date = Query(..., description="Último día del período (inclusive)."),
) -> schemas.Periodo:
    return services.validar_periodo(desde, hasta)


def _administra(usuario: Personal) -> bool:
    return bool(usuario.puede_administrar or usuario.es_super_admin)


@router.get("/inicio", response_model=schemas.PanelInicio)
def panel_inicio(
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    """Estado de hoy de cada área y lo que requiere atención, para el inicio."""
    return services.panel_inicio(db, usuario, _administra(usuario))


@router.get("/produccion", response_model=schemas.PanelProduccion)
def panel_produccion(
    periodo: schemas.Periodo = Depends(_periodo),
    producto_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    """Lotes, salidas y retiros. El estado del catálogo solo para quien administra."""
    return services.panel_produccion(db, periodo, producto_id, _administra(usuario))


@router.get(
    "/inventario",
    response_model=schemas.PanelInventario,
    dependencies=[Depends(require_admin)],
)
def panel_inventario(
    periodo: schemas.Periodo = Depends(_periodo),
    tipo: Optional[Literal["ingrediente", "aditivo"]] = None,
    db: Session = Depends(get_db),
):
    """Stock de materia prima, vencimientos de lotes y movimientos."""
    return services.panel_inventario(db, periodo, tipo)


@router.get("/limpieza", response_model=schemas.PanelLimpieza)
def panel_limpieza(
    periodo: schemas.Periodo = Depends(_periodo),
    sector_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    """Cumplimiento del checklist. Quien solo opera ve sus tareas asignadas."""
    return services.panel_limpieza(db, periodo, sector_id, usuario, _administra(usuario))


@router.get(
    "/equipos",
    response_model=schemas.PanelEquipos,
    dependencies=[Depends(require_admin)],
)
def panel_equipos(
    periodo: schemas.Periodo = Depends(_periodo),
    sector_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    """Equipos, sus incidentes y el estado de calibración y mantenimiento."""
    return services.panel_equipos(db, periodo, sector_id)


@router.get("/calidad", response_model=schemas.PanelCalidad)
def panel_calidad(
    periodo: schemas.Periodo = Depends(_periodo),
    tipo: Optional[TipoIncidente] = None,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    """Incidentes y reclamos. Quien solo opera ve los incidentes que reportó."""
    return services.panel_calidad(
        db, periodo, tipo.value if tipo else None, usuario, _administra(usuario)
    )


@router.get(
    "/personas",
    response_model=schemas.PanelPersonas,
    dependencies=[Depends(require_admin)],
)
def panel_personas(
    periodo: schemas.Periodo = Depends(_periodo),
    db: Session = Depends(get_db),
):
    """Personal, aptitudes, clientes y transportistas."""
    return services.panel_personas(db, periodo)
