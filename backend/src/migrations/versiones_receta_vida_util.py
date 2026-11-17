"""Migración de versiones de receta: agregar columna `vida_util_dias`.

Permite almacenar la vida útil en días de cada versión de receta para calcular
automáticamente la fecha de vencimiento de sus lotes al cerrar la producción.
Idempotente.
"""

from .base import agregar_columna, crear_bitacora, marcar_migracion, migracion_ya_corrio, tablas

CLAVE = "versiones_receta_vida_util"


def migrar_versiones_receta_vida_util() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "versiones_receta" in tablas():
        agregar_columna("versiones_receta", "vida_util_dias", "INTEGER")

    marcar_migracion(CLAVE)
