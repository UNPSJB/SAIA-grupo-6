from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, select
from sqlalchemy.orm import Session, selectinload

from src.auth.dependencies import get_current_user
from src.database import get_db
from src.personal.models import Personal
from src.reposiciones import services
from src.reposiciones.constants import (
    ESTADO_REPOSICION_PARCIAL,
    ESTADO_REPOSICION_PENDIENTE,
    PRIORIDAD_ALTA,
)
from src.reposiciones.models import Reposicion
from src.reposiciones.schemas import (
    ReposicionCumplirRequest,
    ReposicionResponse,
)

router = APIRouter(prefix="/reposiciones", tags=["Reposiciones"])

OrigenReposicionParam = Literal["RETIRO_LOTE", "RECHAZO_ENTREGA", "POR_RECLAMO"]


@router.get(
    "/pendientes",
    response_model=list[ReposicionResponse],
    dependencies=[Depends(get_current_user)],
)
def listar_reposiciones_pendientes(
    origen: Optional[OrigenReposicionParam] = Query(
        None, description="Filtrar por origen de la reposición."
    ),
    db: Session = Depends(get_db),
) -> list[Reposicion]:
    """Listado de reposiciones en estado PENDIENTE o PARCIAL.

    Ordenadas primero por prioridad (ALTA primero) y luego por fecha_registro
    ascendente (las más antiguas primero).
    """
    orden_prioridad = case(
        (Reposicion.prioridad == PRIORIDAD_ALTA, 0),
        else_=1,
    )
    stmt = (
        select(Reposicion)
        .options(
            selectinload(Reposicion.cliente),
            selectinload(Reposicion.producto),
        )
        .where(
            Reposicion.estado.in_(
                [ESTADO_REPOSICION_PENDIENTE, ESTADO_REPOSICION_PARCIAL]
            )
        )
    )
    if origen is not None:
        stmt = stmt.where(Reposicion.origen == origen)

    stmt = stmt.order_by(orden_prioridad.asc(), Reposicion.fecha_registro.asc())
    return list(db.scalars(stmt).all())


@router.post(
    "/{reposicion_id}/cumplir",
    response_model=ReposicionResponse,
    dependencies=[Depends(get_current_user)],
)
def cumplir_reposicion_endpoint(
    reposicion_id: int,
    datos: ReposicionCumplirRequest,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user),
) -> Reposicion:
    """Cumple total o parcialmente una reposición pendiente creando una reserva en un lote sano."""
    return services.cumplir_reposicion(
        db=db,
        reposicion_id=reposicion_id,
        request=datos,
        usuario=usuario,
    )
