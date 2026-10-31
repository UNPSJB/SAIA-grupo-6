from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from src.auth.dependencies import require_admin
from src.database import get_db
from src.exceptions import NotFound

from . import schemas, services


router = APIRouter(
    prefix="/vista-publica",
    tags=["Vista pública"],
)

_CABECERAS_SIN_CACHE = {"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache"}


def _respuesta(
    configuracion,
) -> schemas.ConfiguracionVistaPublicaResponse:
    if configuracion is None or not configuracion.habilitada:
        return schemas.ConfiguracionVistaPublicaResponse(habilitada=False)

    # Una configuración activa siempre tiene código. Si faltara por una base
    # inconsistente, no se expone una URL parcial ni se inventa un identificador.
    if not configuracion.codigo_publico:
        return schemas.ConfiguracionVistaPublicaResponse(habilitada=False)

    return schemas.ConfiguracionVistaPublicaResponse(
        habilitada=True,
        url_publica=services.construir_url_publica(configuracion.codigo_publico),
    )


@router.get(
    "/configuracion",
    response_model=schemas.ConfiguracionVistaPublicaResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_configuracion(db: Session = Depends(get_db)):
    return _respuesta(services.obtener_configuracion(db))


@router.put(
    "/configuracion",
    response_model=schemas.ConfiguracionVistaPublicaResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_configuracion(
    datos: schemas.ConfiguracionVistaPublicaUpdate,
    db: Session = Depends(get_db),
):
    if datos.habilitada:
        # Fallar antes de mutar para no dejar una vista activa sin enlace válido.
        services.construir_url_publica("validacion")
    configuracion = services.actualizar_configuracion(db, datos.habilitada)
    return _respuesta(configuracion)


@router.get(
    "/publica/{codigo_publico}/validar",
    response_model=schemas.ValidacionVistaPublicaResponse,
)
def validar_vista_publica(
    codigo_publico: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Única ruta anónima: no publica información más allá de la validez."""
    if not services.codigo_publico_valido(db, codigo_publico):
        raise NotFound("Vista pública no disponible.", headers=_CABECERAS_SIN_CACHE)

    response.headers.update(_CABECERAS_SIN_CACHE)
    return schemas.ValidacionVistaPublicaResponse()
