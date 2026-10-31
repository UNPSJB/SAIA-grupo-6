import secrets
from typing import Optional

from sqlalchemy.orm import Session

from src.common.persistence import guardar
from src.config import settings
from src.exceptions import BadRequest

from .models import ConfiguracionVistaPublica


ID_CONFIGURACION_UNICA = 1
RUTA_PUBLICA = "publico"


def obtener_configuracion(
    db: Session,
) -> Optional[ConfiguracionVistaPublica]:
    """Obtiene la configuración; la ausencia transitoria equivale a desactivada."""
    return db.get(ConfiguracionVistaPublica, ID_CONFIGURACION_UNICA)


def actualizar_configuracion(
    db: Session, habilitada: bool
) -> ConfiguracionVistaPublica:
    """Activa o desactiva el único enlace público de la instalación."""
    configuracion = obtener_configuracion(db)
    if configuracion is None:
        # La migración crea la fila. Este fallback cubre bases de prueba o una
        # instalación interrumpida sin permitir más de una configuración.
        configuracion = ConfiguracionVistaPublica(id=ID_CONFIGURACION_UNICA)
        db.add(configuracion)

    if habilitada:
        if not configuracion.habilitada or not configuracion.codigo_publico:
            configuracion.codigo_publico = secrets.token_urlsafe(32)
        configuracion.habilitada = True
    else:
        configuracion.habilitada = False
        # Los QR previos no pueden volver a ser válidos tras una reactivación.
        configuracion.codigo_publico = None

    return guardar(db, configuracion)


def construir_url_publica(codigo_publico: str) -> str:
    """Arma el enlace desde la URL canónica configurada para el frontend."""
    if not settings.PUBLIC_APP_URL:
        raise BadRequest(
            "Configurá PUBLIC_APP_URL antes de activar la vista pública."
        )
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/{RUTA_PUBLICA}/{codigo_publico}"


def codigo_publico_valido(db: Session, codigo_publico: str) -> bool:
    """Verifica el enlace vigente sin revelar el estado de la configuración."""
    configuracion = obtener_configuracion(db)
    return bool(
        configuracion
        and configuracion.habilitada
        and configuracion.codigo_publico
        and secrets.compare_digest(codigo_publico, configuracion.codigo_publico)
    )
