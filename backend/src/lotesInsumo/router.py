from datetime import date

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
    lote = services.crear_lote_insumo(db, datos, usuario)
    return services.lote_a_respuesta(lote)


@router.get(
    "",
    response_model=list[schemas.LoteInsumoResponse],
    dependencies=[Depends(require_operador)],
)
def listar_lotes_insumo(
    ingrediente_id: int | None = Query(None, ge=1),
    proveedor_id: int | None = Query(None, ge=1),
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    lotes = services.listar_lotes_insumo(db, ingrediente_id, proveedor_id, incluir_inactivos)
    return [services.lote_a_respuesta(l) for l in lotes]


@router.get(
    "/sugeridos",
    response_model=list[schemas.StockLoteInsumo],
    dependencies=[Depends(require_operador)],
)
def lotes_sugeridos(
    ingrediente_id: int = Query(..., ge=1),
    todos: bool = False,
    db: Session = Depends(get_db),
):
    return services.lotes_sugeridos(db, ingrediente_id, todos)


@router.get(
    "/{lote_insumo_id}",
    response_model=schemas.LoteInsumoResponse,
    dependencies=[Depends(require_operador)],
)
def obtener_lote_insumo(lote_insumo_id: int, db: Session = Depends(get_db)):
    return services.lote_a_respuesta(services.obtener_lote_insumo(db, lote_insumo_id))


@router.get(
    "/{lote_insumo_id}/bajas",
    response_model=list[schemas.BajaLoteInsumoResponse],
    dependencies=[Depends(require_operador)],
)
def listar_bajas_lote_insumo(lote_insumo_id: int, db: Session = Depends(get_db)):
    return services.listar_bajas_lote_insumo(db, lote_insumo_id)


@router.post(
    "/{lote_insumo_id}/baja",
    response_model=schemas.LoteInsumoResponse,
)
def dar_de_baja(
    lote_insumo_id: int,
    datos: schemas.LoteInsumoBaja,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    lote = services.dar_de_baja_lote_insumo(db, lote_insumo_id, datos, usuario)
    return services.lote_a_respuesta(lote)


@router.delete(
    "/{lote_insumo_id}",
    response_model=schemas.LoteInsumoResponse,
)
def eliminar_lote_insumo(
    lote_insumo_id: int,
    motivo: schemas.MotivoBajaTipo = Query("danado"),
    observaciones: str | None = Query(None, max_length=300),
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_operador),
):
    datos = schemas.LoteInsumoBaja(
        motivo=motivo,
        observaciones=observaciones,
        dar_de_baja_lote_completo=True,
    )
    lote = services.dar_de_baja_lote_insumo(db, lote_insumo_id, datos, usuario)
    return services.lote_a_respuesta(lote)


@stock_router.get(
    "/ingredientes",
    response_model=list[schemas.StockIngrediente],
    dependencies=[Depends(require_operador)],
)
def stock_por_ingrediente(
    ingrediente_id: int | None = Query(None, ge=1), db: Session = Depends(get_db)
):
    return services.stock_por_ingrediente(db, ingrediente_id)


@stock_router.get(
    "/lotes-insumo",
    response_model=list[schemas.StockLoteInsumo],
    dependencies=[Depends(require_operador)],
)
def stock_por_lote(
    ingrediente_id: int | None = Query(None, ge=1),
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    return services.stock_por_lote(db, ingrediente_id, incluir_inactivos)


@stock_router.get(
    "/bajas-por-motivo",
    response_model=schemas.IndicadorBajasResponse,
    dependencies=[Depends(require_operador)],
)
def indicador_bajas(
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    db: Session = Depends(get_db),
):
    return services.indicador_bajas_por_motivo(db, fecha_desde, fecha_hasta)
