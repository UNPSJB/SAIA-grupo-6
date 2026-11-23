from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user_activo_completo, require_super_admin
from src.database import get_db
from src.establecimientos import schemas, services
from src.establecimientos.contexto import sede_efectiva
from src.personal.models import Personal

router = APIRouter(prefix="/establecimientos", tags=["Establecimientos"])


@router.get("", response_model=list[schemas.Establecimiento])
def listar_establecimientos(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
    usuario: Personal = Depends(get_current_user_activo_completo),
):
    """El super admin y los gerentes ven todas las sedes (el selector y el
    tablero comparativo); el resto, solo la propia."""
    if usuario.es_super_admin or usuario.es_gerente:
        return services.listar(db, incluir_inactivos and usuario.es_super_admin)
    return [services.obtener(db, sede_efectiva(db))]


@router.get("/actual", response_model=schemas.Establecimiento)
def establecimiento_actual(
    db: Session = Depends(get_db),
    _usuario: Personal = Depends(get_current_user_activo_completo),
):
    """La sede en la que se está trabajando en este request."""
    return services.obtener(db, sede_efectiva(db))


@router.post(
    "",
    response_model=schemas.Establecimiento,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_super_admin)],
)
def crear_establecimiento(datos: schemas.EstablecimientoCreate, db: Session = Depends(get_db)):
    return services.crear(db, datos)


@router.put(
    "/{establecimiento_id}",
    response_model=schemas.Establecimiento,
    dependencies=[Depends(require_super_admin)],
)
def modificar_establecimiento(
    establecimiento_id: int,
    datos: schemas.EstablecimientoUpdate,
    db: Session = Depends(get_db),
):
    return services.modificar(db, establecimiento_id, datos)
