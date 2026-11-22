from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.alergenos import schemas, services
from src.auth.dependencies import require_admin
from src.database import get_db

router = APIRouter(prefix="/alergenos", tags=["alergenos"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[schemas.AlergenoResponse])
def listar_alergenos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    return services.listar_alergenos(db, incluir_inactivos)


@router.post("", response_model=schemas.AlergenoResponse, status_code=status.HTTP_201_CREATED)
def crear_alergeno(datos: schemas.AlergenoCreate, db: Session = Depends(get_db)):
    return services.crear_alergeno(db, datos)


@router.put("/{alergeno_id}", response_model=schemas.AlergenoResponse)
def actualizar_alergeno(alergeno_id: int, datos: schemas.AlergenoUpdate, db: Session = Depends(get_db)):
    return services.actualizar_alergeno(db, alergeno_id, datos)


@router.delete("/{alergeno_id}", response_model=schemas.AlergenoResponse)
def dar_de_baja(alergeno_id: int, db: Session = Depends(get_db)):
    return services.dar_de_baja(db, alergeno_id)


@router.get("/ingredientes/{ingrediente_id}", response_model=schemas.AlergenosDeIngrediente)
def alergenos_de_ingrediente(ingrediente_id: int, db: Session = Depends(get_db)):
    return services.alergenos_de_ingrediente(db, ingrediente_id)


@router.put("/ingredientes/{ingrediente_id}", response_model=schemas.AlergenosDeIngrediente)
def guardar_alergenos_de_ingrediente(
    ingrediente_id: int, datos: schemas.AlergenosDeIngredienteIn, db: Session = Depends(get_db)
):
    return services.guardar_alergenos_de_ingrediente(db, ingrediente_id, datos)


@router.get("/productos/{producto_id}", response_model=schemas.AlergenosDeProducto)
def alergenos_de_producto(
    producto_id: int,
    version_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    return services.alergenos_de_producto(db, producto_id, version_id)
