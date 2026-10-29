from typing import List, Literal, Optional, Union

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.common.paginacion import PAGE_SIZE_MAXIMO, PAGE_SIZE_POR_DEFECTO
from src.database import get_db
from src.auth.dependencies import require_admin
from src.unidadMedida import schemas, services


router = APIRouter(
    prefix="/unidades-medida",
    tags=["Unidades de Medida"],
    dependencies=[Depends(require_admin)],
)

OrdenUnidadMedida = Literal[
    "nombre_asc",
    "nombre_desc",
    "simbolo_asc",
    "simbolo_desc",
]


@router.post("", response_model=schemas.UnidadMedidaResponse, status_code=status.HTTP_201_CREATED)
def crear_unidad_medida(datos: schemas.UnidadMedidaCreate, db: Session = Depends(get_db)):
    return services.crear_unidad_medida(db, datos)


@router.get("", response_model=Union[List[schemas.UnidadMedidaResponse], schemas.UnidadMedidaPagina])
def listar_unidades_medida(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca en nombre y símbolo (sin distinguir mayúsculas ni tildes).",
    ),
    orden: OrdenUnidadMedida = "nombre_asc",
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página. Sin este parámetro se devuelve la lista completa (la usan los dropdowns).",
    ),
    page_size: int = Query(PAGE_SIZE_POR_DEFECTO, ge=1, le=PAGE_SIZE_MAXIMO),
    db: Session = Depends(get_db),
):
    if page is None:
        return services.listar_unidades_medida(db, incluir_inactivos, buscar)
    items, total = services.listar_unidades_medida_paginado(
        db, incluir_inactivos, page, page_size, buscar=buscar, orden=orden
    )
    return schemas.UnidadMedidaPagina(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def obtener_unidad_medida(unidad_id: int, db: Session = Depends(get_db)):
    return services.obtener_unidad_medida(db, unidad_id)


@router.put("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def actualizar_unidad_medida(unidad_id: int, datos: schemas.UnidadMedidaUpdate, db: Session = Depends(get_db)):
    return services.actualizar_unidad_medida(db, unidad_id, datos)


@router.delete("/{unidad_id}", response_model=schemas.UnidadMedidaResponse)
def eliminar_unidad_medida(unidad_id: int, db: Session = Depends(get_db)):
    return services.eliminar_unidad_medida(db, unidad_id)
