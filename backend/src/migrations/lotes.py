"""Migración de lotes: columna `tipo` del maestro de insumos.

Los productos y los lotes migraron a `productos` y `lotes_producto`
(ver `trazabilidad.py`). Solo queda agregar la columna `tipo` de `insumos` en bases
muy viejas; `insumos_tipo.py` después la convierte a ingrediente/aditivo.
"""

import logging

from sqlalchemy import text

from src.database import engine

from .base import agregar_columna, tablas

logger = logging.getLogger(__name__)


def migrar_lotes() -> None:
    if "insumos" not in tablas():
        return
    agregar_columna("insumos", "tipo", "VARCHAR(20) NOT NULL DEFAULT 'insumo'")
    with engine.begin() as conexion:
        conexion.execute(
            text("CREATE INDEX IF NOT EXISTS ix_insumos_tipo ON insumos (tipo)")
        )
