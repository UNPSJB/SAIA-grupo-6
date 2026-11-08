from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.productos import schemas, services

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.ProductoResponse, status_code=status.HTTP_201_CREATED)
def crear_producto(datos: schemas.ProductoCreate, db: Session = Depends(get_db)):
    return services.crear_producto(db, datos)


@router.get("", response_model=list[schemas.ProductoResponse])
def listar_productos(
    incluir_inactivos: bool = False,
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    return services.listar_productos(db, incluir_inactivos, buscar)


@router.get("/{producto_id}", response_model=schemas.ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    return services.obtener_producto(db, producto_id)


@router.put("/{producto_id}", response_model=schemas.ProductoResponse)
def actualizar_producto(
    producto_id: int,
    datos: schemas.ProductoUpdate,
    db: Session = Depends(get_db),
):
    return services.actualizar_producto(db, producto_id, datos)


@router.delete("/{producto_id}", response_model=schemas.ProductoResponse)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    return services.eliminar_producto(db, producto_id)
