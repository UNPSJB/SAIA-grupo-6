"""Migración: agrega columnas tipo y factor_a_base a unidades_medida.

tipo: enum de texto (masa, volumen, unidad), default 'unidad'.
factor_a_base: NUMERIC(10,4) > 0, default 1.0.
"""

from src.migrations.base import agregar_columna, marcar_migracion, migracion_ya_corrio, crear_bitacora


def migrar_unidades_medida_tipo_factor() -> None:
    crear_bitacora()
    if migracion_ya_corrio("unidades_medida_tipo_factor"):
        return
    agregar_columna(
        "unidades_medida",
        "tipo",
        "VARCHAR(10) NOT NULL DEFAULT 'unidad'",
    )
    agregar_columna(
        "unidades_medida",
        "factor_a_base",
        "NUMERIC(10,4) NOT NULL DEFAULT 1.0",
    )
    marcar_migracion("unidades_medida_tipo_factor")
