"""Insumos sin rótulo propio (frutas, verduras, huevos, carne a granel).

Agrega `insumos.sin_rotulo`. Idempotente: se llama temprano (antes de las
migraciones que usan el ORM sobre `insumos`) y otra vez al final.
"""

from .base import agregar_columna, hay_insumos_viejo, tablas


def migrar_insumos_sin_rotulo() -> None:
    # La tabla vieja `insumos` (el maestro que hoy es `ingredientes`) no lleva
    # la columna: la convierte otra migración y después se vuelve a llamar.
    if "insumos" not in tablas() or hay_insumos_viejo():
        return
    agregar_columna("insumos", "sin_rotulo", "BOOLEAN NOT NULL DEFAULT 0")
