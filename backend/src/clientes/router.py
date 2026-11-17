from typing import Optional, Union

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.common.paginacion import ParamsPaginacion, Pagina
from src.database import get_db
from src.clientes import schemas, services


router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.ClienteResponse, status_code=status.HTTP_201_CREATED)
def crear_cliente(datos: schemas.ClienteCreate, db: Session = Depends(get_db)):
    return services.crear_cliente(db, datos)


@router.get("", response_model=Union[list[schemas.ClienteResponse], Pagina[schemas.ClienteResponse]])
def listar_clientes(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca por nombre, documento, domicilio o teléfono (sin distinguir mayúsculas ni tildes).",
    ),
    page: Optional[int] = Query(
        None,
        ge=1,
        description="Número de página (desde 1). Si no se pasa, devuelve la lista completa.",
    ),
    page_size: int = Query(
        10,
        ge=1,
        le=100,
        description="Filas por página (solo si se pasa `page`).",
    ),
    orden: str = Query(
        "nombre_asc",
        description="Columna y dirección de orden: nombre_asc, nombre_desc, documento_asc, documento_desc.",
    ),
    db: Session = Depends(get_db),
):
    if page is not None:
        items, total = services.listar_clientes(
            db,
            incluir_inactivos=incluir_inactivos,
            buscar=buscar,
            page=page,
            page_size=page_size,
            orden=orden,
        )
        return Pagina(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    return services.listar_clientes(
        db,
        incluir_inactivos=incluir_inactivos,
        buscar=buscar,
        orden=orden,
    )


@router.get("/{cliente_id}", response_model=schemas.ClienteResponse)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return services.obtener_cliente(db, cliente_id)


@router.put("/{cliente_id}", response_model=schemas.ClienteResponse)
def actualizar_cliente(
    cliente_id: int,
    datos: schemas.ClienteUpdate,
    db: Session = Depends(get_db),
):
    return services.actualizar_cliente(db, cliente_id, datos)


@router.delete("/{cliente_id}", response_model=schemas.ClienteResponse)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return services.eliminar_cliente(db, cliente_id)
