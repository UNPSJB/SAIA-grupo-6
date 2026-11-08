from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.lotesInsumo import schemas, services
from src.personal.models import Personal

router = APIRouter(prefix="/lotes-insumo", tags=["Lotes de insumo"])
stock_router = APIRouter(prefix="/stock", tags=["Stock de insumos"])


@router.post(
    "",
    response_model=schemas.LoteInsumoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_lote_insumo(
    datos: schemas.LoteInsumoCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return services.crear_lote_insumo(db, datos, usuario)


@router.get(
    "",
    response_model=list[schemas.LoteInsumoResponse],
    dependencies=[Depends(require_admin)],
)
def listar_lotes_insumo(
    insumo_id: int | None = Query(None, ge=1),
    proveedor_id: int | None = Query(None, ge=1),
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    return services.listar_lotes_insumo(db, insumo_id, proveedor_id, incluir_inactivos)


@router.get(
    "/sugeridos",
    response_model=list[schemas.StockLoteInsumo],
    dependencies=[Depends(require_operador)],
)
def lotes_sugeridos(
    insumo_id: int = Query(..., ge=1),
    todos: bool = False,
    db: Session = Depends(get_db),
):
    """Lotes ordenados por vencimiento (el primero disponible es el sugerido).

    Con `todos=true` incluye también los vencidos o sin saldo.
    """
    return services.lotes_sugeridos(db, insumo_id, todos)


@router.get(
    "/{lote_insumo_id}",
    response_model=schemas.LoteInsumoResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_lote_insumo(lote_insumo_id: int, db: Session = Depends(get_db)):
    return services.obtener_lote_insumo(db, lote_insumo_id)


@router.post(
    "/{lote_insumo_id}/baja",
    response_model=schemas.LoteInsumoResponse,
    dependencies=[Depends(require_admin)],
)
def dar_de_baja(
    lote_insumo_id: int,
    datos: schemas.LoteInsumoBaja,
    db: Session = Depends(get_db),
):
    return services.dar_de_baja_lote_insumo(db, lote_insumo_id, datos.motivo)


@router.delete(
    "/{lote_insumo_id}",
    response_model=schemas.LoteInsumoResponse,
    dependencies=[Depends(require_admin)],
)
def eliminar_lote_insumo(
    lote_insumo_id: int,
    motivo: str = Query("Baja manual", min_length=1, max_length=300),
    db: Session = Depends(get_db),
):
    """No borra la fila: es una baja lógica, igual que `POST /{id}/baja`."""
    return services.dar_de_baja_lote_insumo(db, lote_insumo_id, motivo)


@stock_router.get(
    "/insumos",
    response_model=list[schemas.StockInsumo],
    dependencies=[Depends(require_admin)],
)
def stock_por_insumo(
    insumo_id: int | None = Query(None, ge=1), db: Session = Depends(get_db)
):
    return services.stock_por_insumo(db, insumo_id)


@stock_router.get(
    "/lotes-insumo",
    response_model=list[schemas.StockLoteInsumo],
    dependencies=[Depends(require_admin)],
)
def stock_por_lote(
    insumo_id: int | None = Query(None, ge=1),
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    return services.stock_por_lote(db, insumo_id, incluir_inactivos)
