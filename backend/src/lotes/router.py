from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.lotes import schemas, services
from src.lotes.constants import ESTADOS_LOTE
from src.personal.models import Personal

router = APIRouter(prefix="/lotes", tags=["Lotes de Producción"])


@router.post(
    "",
    response_model=schemas.LoteDetalle,
    status_code=status.HTTP_201_CREATED,
)
def crear_lote(
    datos: schemas.LoteCreate,
    db: Session = Depends(get_db),
    # E9: quien opera inicia el lote desde la vista escalada de la receta.
    usuario: Personal = Depends(require_operador),
):
    lote = services.crear_lote(db, datos, usuario)
    return services.detalle(db, lote)


@router.get(
    "",
    response_model=list[schemas.LoteResumen],
    dependencies=[Depends(require_operador)],
)
def listar_lotes(
    producto_id: int | None = Query(None, ge=1),
    estado: str | None = Query(None, pattern=f"^({'|'.join(ESTADOS_LOTE)})$"),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
):
    lotes = services.listar_lotes(db, producto_id, estado, fecha_desde, fecha_hasta)
    return [services.resumen(lote) for lote in lotes]


@router.get(
    "/dashboard",
    response_model=schemas.DashboardLotesResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_dashboard(
    producto_id: int | None = Query(None, ge=1),
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
):
    return services.dashboard(db, producto_id, fecha_desde, fecha_hasta)


@router.get(
    "/{lote_id}",
    response_model=schemas.LoteDetalle,
    dependencies=[Depends(require_operador)],
)
def obtener_lote(lote_id: int, db: Session = Depends(get_db)):
    return services.detalle(db, services.obtener_lote(db, lote_id))


@router.post(
    "/{lote_id}/checklist/{item_id}/completar",
    response_model=schemas.LoteDetalle,
)
def completar_item(
    lote_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    lote = services.completar_item(db, lote_id, item_id, usuario)
    return services.detalle(db, lote)


@router.post(
    "/{lote_id}/checklist/{item_id}/consumos",
    response_model=schemas.ConsumoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_consumo(
    lote_id: int,
    item_id: int,
    datos: schemas.ConsumoCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    consumo, advertencias = services.registrar_consumo(db, lote_id, item_id, datos, usuario)
    return services.consumo_a_respuesta(consumo, advertencias)


@router.post(
    "/{lote_id}/cerrar",
    response_model=schemas.LoteDetalle,
    dependencies=[Depends(require_operador)],
)
def cerrar_lote(lote_id: int, datos: schemas.LoteCierre, db: Session = Depends(get_db)):
    return services.detalle(db, services.cerrar_lote(db, lote_id, datos))


@router.post(
    "/{lote_id}/cancelar",
    response_model=schemas.LoteDetalle,
    dependencies=[Depends(require_admin)],
)
def cancelar_lote(lote_id: int, datos: schemas.LoteCancelacion, db: Session = Depends(get_db)):
    return services.detalle(db, services.cancelar_lote(db, lote_id, datos.motivo))
