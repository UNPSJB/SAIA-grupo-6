"""Migración: agrega columnas densidad_g_ml y peso_unitario_g a insumos.

Ambas son NUMERIC(10,4) NULL, opcionales. La validación de obligatoriedad
según el tipo de unidad se hace en la capa de servicio.
"""

from src.migrations.base import agregar_columna, marcar_migracion, migracion_ya_corrio, crear_bitacora


def migrar_insumos_densidad_peso() -> None:
    crear_bitacora()
    if migracion_ya_corrio("insumos_densidad_peso"):
        return
    agregar_columna("insumos", "densidad_g_ml", "NUMERIC(10,4) NULL")
    agregar_columna("insumos", "peso_unitario_g", "NUMERIC(10,4) NULL")
    marcar_migracion("insumos_densidad_peso")
