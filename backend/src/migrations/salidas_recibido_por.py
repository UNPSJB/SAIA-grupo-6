"""Migración de salidas: agregar columna `recibido_por`.

Guarda el nombre de quien recibió la entrega (si corresponde).
Idempotente.
"""

import logging

from sqlalchemy import text

from src.database import engine
from .base import agregar_columna, crear_bitacora, marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "salidas_recibido_por"


def migrar_salidas_recibido_por() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "salidas" in tablas():
        agregar_columna("salidas", "recibido_por", "VARCHAR(100)")

    marcar_migracion(CLAVE)
