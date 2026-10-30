from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.proveedores import schemas, services


router = APIRouter(
    prefix="/proveedores",
    tags=["Proveedores"],
    dependencies=[Depends(require_admin)],
)


@router.post("", response_model=schemas.ProveedorResponse, status_code=status.HTTP_201_CREATED)
def crear_proveedor(datos: schemas.ProveedorCreate, db: Session = Depends(get_db)):
    return services.crear_proveedor(db, datos)


@router.get("", response_model=list[schemas.ProveedorResponse])
def listar_proveedores(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_proveedores(db, incluir_inactivos)


@router.get("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def obtener_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    return services.obtener_proveedor(db, proveedor_id)


@router.put("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def actualizar_proveedor(
    proveedor_id: int,
    datos: schemas.ProveedorUpdate,
    db: Session = Depends(get_db),
):
    return services.actualizar_proveedor(db, proveedor_id, datos)


@router.delete("/{proveedor_id}", response_model=schemas.ProveedorResponse)
def eliminar_proveedor(proveedor_id: int, db: Session = Depends(get_db)):
    return services.eliminar_proveedor(db, proveedor_id)
