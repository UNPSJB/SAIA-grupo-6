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

# Solo quedan las clases funcionales y las sugerencias: el aditivo es un
# ingrediente con `es_aditivo` (ver `src.ingredientes`).


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


@router.get("/sugerencias", response_model=list[schemas.SugerenciaAditivo])
def listar_sugerencias(
    buscar: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    """Lista de referencia (Codex / CAA) para completar clase e INS de un ingrediente aditivo."""
    return services.listar_sugerencias(db, buscar)
