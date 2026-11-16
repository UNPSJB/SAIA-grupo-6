"""E13: tablas de borradores de rotulado y trazabilidad de ediciones.

Las tablas `borradores_rotulado` y `campos_rotulado_editados` son creadas
por `ModeloBase.metadata.create_all()` antes de que corran las migraciones.
Esta migración solo registra que el módulo rotulado está instalado y es
idempotente: no borra ni modifica datos existentes.
"""

from .base import marcar_migracion, migracion_ya_corrio, tablas

_CLAVE = "rotulado_hu105_borradores"


def migrar_rotulado() -> None:
    if "borradores_rotulado" not in tablas():
        # Las tablas ya fueron creadas por create_all; si no existen,
        # algo falló antes. No las creamos aquí con SQL crudo para no
        # duplicar la definición del ORM.
        return
    if not migracion_ya_corrio(_CLAVE):
        marcar_migracion(_CLAVE)
