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


@router.get(
    "/indicadores",
    response_model=schemas.IndicadoresVistaPublicaResponse,
    dependencies=[Depends(require_admin)],
)
def obtener_indicadores(db: Session = Depends(get_db)):
    """Catálogo y estado de cada indicador para el panel administrativo.

    Incluye `con_datos` para poder avisar cuando un indicador está visible pero
    el público todavía no lo ve porque no hay datos suficientes.
    """
    return schemas.IndicadoresVistaPublicaResponse(
        indicadores=services.obtener_indicadores(db, incluir_datos=True)
    )


@router.put(
    "/indicadores",
    response_model=schemas.IndicadoresVistaPublicaResponse,
    dependencies=[Depends(require_admin)],
)
def actualizar_indicadores(
    datos: schemas.IndicadoresVistaPublicaUpdate,
    db: Session = Depends(get_db),
):
    """Reemplaza la selección de indicadores. Solo admin, validado por catálogo."""
    return schemas.IndicadoresVistaPublicaResponse(
        indicadores=services.actualizar_indicadores(
            db, [(item.clave, item.habilitado) for item in datos.indicadores]
        )
    )


@router.get(
    "/publica/{codigo_publico}/indicadores",
    response_model=schemas.IndicadoresPublicosResponse,
)
def indicadores_publicos(
    codigo_publico: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Indicadores agregados del enlace público. Anónimo y sin caché.

    Si el código no es el vigente, responde 404 sin distinguir entre
    "desactivada" y "código inválido".
    """
    if not services.codigo_publico_valido(db, codigo_publico):
        raise NotFound("Vista pública no disponible.", headers=_CABECERAS_SIN_CACHE)

    response.headers.update(_CABECERAS_SIN_CACHE)
    return schemas.IndicadoresPublicosResponse(
        indicadores=services.indicadores_publicos(db)
    )
