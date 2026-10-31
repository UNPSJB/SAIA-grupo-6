from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.auditoria import schemas, services
from src.common.paginacion import ParamsPaginacion
from src.database import get_db

# La bitácora es de la persona con permiso de administrar: contiene el
# detalle de cada cambio de TODAS las entidades del sistema.
router = APIRouter(
    prefix="/auditoria",
    tags=["Auditoría"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=schemas.AuditLogPagina)
def listar_auditoria(
    entidad: Optional[str] = Query(
        None, max_length=60, description="Tabla auditada (su __tablename__)."
    ),
    entidad_id: Optional[str] = Query(
        None, max_length=40, description="PK de la fila auditada (compuesta: unida con '-')."
    ),
    usuario_id: Optional[int] = Query(None, ge=1, description="Quién hizo el cambio."),
    accion: Optional[schemas.AccionAuditoria] = Query(
        None, description="CREAR | MODIFICAR | BAJA | REACTIVAR | ELIMINAR."
    ),
    desde: Optional[date] = Query(None, description="Eventos desde ese día (inclusive)."),
    hasta: Optional[date] = Query(None, description="Eventos hasta ese día (inclusive)."),
    paginacion: ParamsPaginacion = Depends(),
    db: Session = Depends(get_db),
):
    """Bitácora de cambios de todas las entidades, siempre paginada."""
    items, total = services.listar_auditoria(
        db,
        entidad=entidad,
        entidad_id=entidad_id,
        usuario_id=usuario_id,
        accion=accion,
        desde=desde,
        hasta=hasta,
        page=paginacion.page,
        page_size=paginacion.page_size,
    )
    return schemas.AuditLogPagina(
        items=items,
        total=total,
        page=paginacion.page,
        page_size=paginacion.page_size,
    )


@router.get("/entidades", response_model=list[str])
def listar_entidades(db: Session = Depends(get_db)):
    """Lista de entidades distintas presentes en la bitácora, para autocompletar filtros."""
    return services.listar_entidades(db)

