"""Migración de salidas: momentos exactos de despacho y entrega.

Agrega `despachado_en` y `entregado_en` (DATETIME) para guardar la hora en que
se confirmó cada acción. Las columnas `fecha_despacho` / `fecha_entrega` siguen
guardando la fecha operativa elegida por el usuario. Idempotente.
"""

import logging

from .base import (
    agregar_columna,
    crear_bitacora,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "salidas_momentos"


def migrar_salidas_momentos() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "salidas" in tablas():
        agregar_columna("salidas", "despachado_en", "DATETIME")
        agregar_columna("salidas", "entregado_en", "DATETIME")

    marcar_migracion(CLAVE)
