from typing import Optional, Union

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user_activo_completo, require_admin
from src.common.paginacion import ParamsPaginacion, Pagina
from src.database import get_db
from src.transportistas import schemas, services


router = APIRouter(
    prefix="/transportistas",
    tags=["Transportistas"],
)


@router.post(
    "",
    response_model=schemas.TransportistaResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def crear_transportista(datos: schemas.TransportistaCreate, db: Session = Depends(get_db)):
    return services.crear_transportista(db, datos)


@router.get(
    "",
    response_model=Union[list[schemas.TransportistaResponse], Pagina[schemas.TransportistaResponse]],
    dependencies=[Depends(get_current_user_activo_completo)],
)
def listar_transportistas(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(
        None,
        max_length=100,
        description="Busca por razón social, CUIT, teléfono, email, domicilio u observaciones (sin distinguir mayúsculas ni tildes).",
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
        "razon_social_asc",
        description="Columna y dirección de orden: razon_social_asc, razon_social_desc, cuit_asc, cuit_desc.",
    ),
    db: Session = Depends(get_db),
):
    if page is not None:
        items, total = services.listar_transportistas(
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
    return services.listar_transportistas(
        db,
        incluir_inactivos=incluir_inactivos,
        buscar=buscar,
        orden=orden,
    )


@router.get(
    "/{transportista_id}",
    response_model=schemas.TransportistaResponse,
    dependencies=[Depends(get_current_user_activo_completo)],
)
def obtener_transportista(transportista_id: int, db: Session = Depends(get_db)):
    return services.obtener_transportista(db, transportista_id)


@router.put(
    "/{transportista_id}",
    response_model=schemas.TransportistaResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_transportista(
    transportista_id: int,
    datos: schemas.TransportistaUpdate,
    db: Session = Depends(get_db),
):
    return services.actualizar_transportista(db, transportista_id, datos)


@router.delete(
    "/{transportista_id}",
    response_model=schemas.TransportistaResponse,
    dependencies=[Depends(require_admin)],
)
def eliminar_transportista(transportista_id: int, db: Session = Depends(get_db)):
    return services.eliminar_transportista(db, transportista_id)
