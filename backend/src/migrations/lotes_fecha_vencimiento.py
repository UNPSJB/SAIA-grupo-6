"""Migración de lotes: agregar columna `fecha_vencimiento`.

Permite marcar la fecha de vencimiento de un lote para bloquear reservas
y despachos sobre lotes ya vencidos (regla de inocuidad alimentaria).
Idempotente.
"""

import logging

from sqlalchemy import text

from src.database import engine
from .base import agregar_columna, crear_bitacora, marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "lotes_producto_fecha_vencimiento"


def migrar_lotes_fecha_vencimiento() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "lotes_producto" in tablas():
        agregar_columna("lotes_producto", "fecha_vencimiento", "DATE")

    marcar_migracion(CLAVE)
