from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, require_admin
from src.database import get_db
from src.pyme import schemas, services

router = APIRouter(prefix="/pyme", tags=["Configuración de la Pyme"])


def _respuesta(configuracion) -> schemas.ConfiguracionPymeResponse:
    if configuracion is None:
        return schemas.ConfiguracionPymeResponse()
    return schemas.ConfiguracionPymeResponse.model_validate(configuracion)


@router.get("", response_model=schemas.ConfiguracionPymeResponse)
def obtener_configuracion(
    db: Session = Depends(get_db),
    _usuario=Depends(get_current_user),
):
    """Datos de la Pyme para cualquier usuario autenticado (los usan los PDF)."""
    return _respuesta(services.obtener_configuracion(db))


@router.put(
    "",
    response_model=schemas.ConfiguracionPymeResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_configuracion(
    datos: schemas.ConfiguracionPymeUpdate,
    db: Session = Depends(get_db),
):
    cambios = datos.model_dump(exclude_unset=True)
    return _respuesta(services.actualizar_configuracion(db, cambios))


@router.post(
    "/logo",
    response_model=schemas.ConfiguracionPymeResponse,
    dependencies=[Depends(require_admin)],
)
def subir_logo(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return _respuesta(services.guardar_logo(db, archivo))


@router.delete(
    "/logo",
    response_model=schemas.ConfiguracionPymeResponse,
    dependencies=[Depends(require_admin)],
)
def quitar_logo(db: Session = Depends(get_db)):
    return _respuesta(services.eliminar_logo(db))
