"""Migración de la configuración de identidad de la Pyme.

Crea la tabla `configuracion_pyme` si todavía no existe. Es idempotente.
"""

import logging

from src.database import engine
from src.models import ModeloBase
from src.pyme.models import ConfiguracionPyme
from .base import crear_bitacora, marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "pyme"


def migrar_pyme() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return
    if ConfiguracionPyme.__tablename__ not in tablas():
        logger.info("Migración: creando tabla %s", ConfiguracionPyme.__tablename__)
        with engine.begin() as conexion:
            ModeloBase.metadata.create_all(conexion)
    marcar_migracion(CLAVE)
