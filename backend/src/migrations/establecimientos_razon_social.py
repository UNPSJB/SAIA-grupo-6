"""Razón social del establecimiento.

Agrega `establecimientos.razon_social`: el nombre legal del elaborador que va
en el rótulo (el `nombre` es el interno de la sede, "Planta Norte"). El
rotulado lo toma para autocompletar la razón social; el domicilio sale de la
`direccion`. Idempotente.
"""

from .base import agregar_columna, tablas


def migrar_establecimientos_razon_social() -> None:
    if "establecimientos" not in tablas():
        return
    agregar_columna("establecimientos", "razon_social", "VARCHAR(200)")
