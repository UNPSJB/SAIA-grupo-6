from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from src.database import get_db
from src.auth.dependencies import require_admin, require_operador
from src.insumoQuimico import schemas, services


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

