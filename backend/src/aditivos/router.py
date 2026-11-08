from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.aditivos import schemas, services
from src.auth.dependencies import require_admin
from src.database import get_db

router = APIRouter(
    prefix="/aditivos",
    tags=["Aditivos"],
    dependencies=[Depends(require_admin)],
)

# Las rutas de clases van antes que `/{aditivo_id}`: si no, "clases" se
# intentaría leer como id y respondería 422.


@router.get("/clases", response_model=list[schemas.ClaseFuncionalResponse])
def listar_clases(incluir_inactivas: bool = False, db: Session = Depends(get_db)):
    return services.listar_clases(db, incluir_inactivas)


@router.post(
    "/clases",
    response_model=schemas.ClaseFuncionalResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_clase(datos: schemas.ClaseFuncionalCreate, db: Session = Depends(get_db)):
    return services.crear_clase(db, datos)


@router.put("/clases/{clase_id}", response_model=schemas.ClaseFuncionalResponse)
def actualizar_clase(
    clase_id: int, datos: schemas.ClaseFuncionalUpdate, db: Session = Depends(get_db)
):
    return services.actualizar_clase(db, clase_id, datos)


@router.delete("/clases/{clase_id}", response_model=schemas.ClaseFuncionalResponse)
def eliminar_clase(clase_id: int, db: Session = Depends(get_db)):
    return services.eliminar_clase(db, clase_id)


@router.get("", response_model=list[schemas.AditivoResponse])
def listar_aditivos(
    incluir_inactivos: bool = False,
    clase_funcional_id: Optional[int] = Query(None, ge=1),
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    return services.listar_aditivos(db, incluir_inactivos, clase_funcional_id, buscar)


@router.post("", response_model=schemas.AditivoResponse, status_code=status.HTTP_201_CREATED)
def crear_aditivo(datos: schemas.AditivoCreate, db: Session = Depends(get_db)):
    return services.crear_aditivo(db, datos)


@router.get("/{aditivo_id}", response_model=schemas.AditivoResponse)
def obtener_aditivo(aditivo_id: int, db: Session = Depends(get_db)):
    return services.obtener_aditivo(db, aditivo_id)


@router.put("/{aditivo_id}", response_model=schemas.AditivoResponse)
def actualizar_aditivo(
    aditivo_id: int, datos: schemas.AditivoUpdate, db: Session = Depends(get_db)
):
    return services.actualizar_aditivo(db, aditivo_id, datos)


@router.delete("/{aditivo_id}", response_model=schemas.AditivoResponse)
def eliminar_aditivo(aditivo_id: int, db: Session = Depends(get_db)):
    return services.eliminar_aditivo(db, aditivo_id)
