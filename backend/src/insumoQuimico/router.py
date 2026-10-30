from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import require_admin, require_operador
from src.insumoQuimico import schemas, services, stock_services
from src.insumoQuimico.models import TipoMovimientoStock
from src.personal.models import Personal


router = APIRouter(
    prefix="/insumos-quimicos",
    tags=["Insumos Químicos"],
)

# Gestión del catálogo: solo quien administra.
_DEP_ADMIN = [Depends(require_admin)]

# Listado mínimo para completar el checklist: alcanza con tener sesión operativa.
_DEP_OPERAR = [Depends(require_operador)]


@router.get("/opciones", response_model=List[schemas.InsumoQuimicoOpcion], dependencies=_DEP_OPERAR)
def listar_opciones_insumos(db: Session = Depends(get_db)):
    """Datos mínimos (id, nombre y unidad) para que el operario elija el
    producto utilizado al marcar una tarea del checklist."""
    return services.listar_opciones_insumos(db)


@router.get(
    "/stock",
    response_model=List[schemas.StockInsumoQuimicoResponse],
    dependencies=_DEP_ADMIN,
)
def listar_stock_actual(db: Session = Depends(get_db)):
    return stock_services.listar_stock_actual(db)


@router.get(
    "/stock/movimientos",
    response_model=schemas.MovimientosStockResponse,
    dependencies=_DEP_ADMIN,
)
def listar_movimientos_stock(
    insumo_quimico_id: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    tipo: Optional[TipoMovimientoStock] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return stock_services.listar_movimientos(
        db, insumo_quimico_id, fecha_desde, fecha_hasta, tipo, limit, offset
    )


@router.get(
    "/stock/lotes",
    response_model=schemas.LotesStockResponse,
    dependencies=_DEP_ADMIN,
)
def listar_lotes_stock(
    proveedor_id: Optional[int] = Query(None),
    insumo_quimico_id: Optional[int] = Query(None),
    numero_lote: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return stock_services.listar_lotes(
        db, proveedor_id, insumo_quimico_id, numero_lote, limit, offset
    )


@router.patch(
    "/{insumo_id}/stock/minimo",
    response_model=schemas.StockInsumoQuimicoResponse,
    dependencies=_DEP_ADMIN,
)
def actualizar_stock_minimo(
    insumo_id: int,
    datos: schemas.StockMinimoUpdate,
    db: Session = Depends(get_db),
):
    return stock_services.actualizar_stock_minimo(db, insumo_id, datos)


@router.post(
    "/{insumo_id}/stock/ingresos",
    response_model=schemas.StockInsumoQuimicoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_ingreso_stock(
    insumo_id: int,
    datos: schemas.IngresoStockCreate,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(require_admin),
):
    return stock_services.registrar_ingreso(db, insumo_id, datos, current_user)


@router.post(
    "/{insumo_id}/stock/ajustes",
    response_model=schemas.StockInsumoQuimicoResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_ajuste_stock(
    insumo_id: int,
    datos: schemas.AjusteStockCreate,
    db: Session = Depends(get_db),
    current_user: Personal = Depends(require_admin),
):
    return stock_services.registrar_ajuste(db, insumo_id, datos, current_user)


@router.post("", response_model=schemas.InsumoQuimicoResponse, status_code=status.HTTP_201_CREATED, dependencies=_DEP_ADMIN)
def crear_insumo_quimico(datos: schemas.InsumoQuimicoCreate, db: Session = Depends(get_db)):
    return services.crear_insumo_quimico(db, datos)

@router.get("", response_model=List[schemas.InsumoQuimicoResponse], dependencies=_DEP_ADMIN)
def listar_insumos_quimicos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_insumos_quimicos(db, incluir_inactivos)

@router.get("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse, dependencies=_DEP_ADMIN)
def obtener_insumo_quimico(insumo_id: int, db: Session = Depends(get_db)):
    return services.obtener_insumo_quimico(db, insumo_id)

@router.put("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse, dependencies=_DEP_ADMIN)
def actualizar_insumo_quimico(insumo_id: int, datos: schemas.InsumoQuimicoUpdate, db: Session = Depends(get_db)):
    return services.actualizar_insumo_quimico(db, insumo_id, datos)

@router.delete("/{insumo_id}", response_model=schemas.InsumoQuimicoResponse, dependencies=_DEP_ADMIN)
def eliminar_insumo_quimico(insumo_id: int, db: Session = Depends(get_db)):
    return services.eliminar_insumo_quimico(db, insumo_id)

