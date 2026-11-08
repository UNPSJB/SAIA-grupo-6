from decimal import Decimal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin, require_operador
from src.database import get_db
from src.personal.models import Personal
from src.recetas import schemas, services

# Consultar y escalar es del rol operar (E9: se consulta antes de elaborar,
# en solo lectura). Crear recetas y versiones nuevas es de administración.
router = APIRouter(
    prefix="/recetas",
    tags=["Recetas"],
    dependencies=[Depends(require_operador)],
)


@router.post("", response_model=schemas.RecetaResponse, status_code=status.HTTP_201_CREATED)
def crear_receta(
    datos: schemas.RecetaCreate,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return services.a_respuesta(db, services.crear_receta(db, datos, usuario))


@router.get("", response_model=list[schemas.RecetaResponse])
def listar_recetas(incluir_inactivas: bool = False, db: Session = Depends(get_db)):
    return [services.a_respuesta(db, r) for r in services.listar_recetas(db, incluir_inactivas)]


@router.get("/versiones/{version_id}", response_model=schemas.VersionDetalle)
def obtener_version(version_id: int, db: Session = Depends(get_db)):
    return services.a_detalle(services.obtener_version(db, version_id))


@router.get("/{receta_id}", response_model=schemas.RecetaResponse)
def obtener_receta(receta_id: int, db: Session = Depends(get_db)):
    return services.a_respuesta(db, services.obtener_receta(db, receta_id))


@router.get("/{receta_id}/versiones", response_model=list[schemas.VersionResumen])
def listar_versiones(receta_id: int, db: Session = Depends(get_db)):
    return services.listar_versiones(db, receta_id)


@router.get("/{receta_id}/escalado", response_model=schemas.RecetaEscalada)
def escalar_receta(
    receta_id: int,
    cantidad_objetivo: Decimal | None = Query(None, gt=0, max_digits=14, decimal_places=3),
    factor: Decimal | None = Query(None, gt=0, max_digits=14, decimal_places=6),
    db: Session = Depends(get_db),
):
    """Vista de cálculo de la versión vigente: no modifica la receta guardada."""
    return services.escalar_receta(db, receta_id, cantidad_objetivo, factor)


@router.post(
    "/{receta_id}/versiones",
    response_model=schemas.VersionDetalle,
    status_code=status.HTTP_201_CREATED,
)
def crear_version(
    receta_id: int,
    datos: schemas.VersionRecetaIn,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(require_admin),
):
    return services.a_detalle(services.crear_version(db, receta_id, datos, usuario))
