"""Migración de bootstrap para la tabla de configuración de vista pública.

La tabla se crea con `metadata.create_all()` antes de `run_migrations()`.
Esta migración asegura que exista una única fila persistida con la vista
pública desactivada (opt-in), de forma idempotente.
"""

from src.database import engine
from sqlalchemy import text

from .base import columnas_de


def migrar_vista_publica() -> None:
    """Inserta la fila inicial de configuración de vista pública si falta.

    Desde el multiestablecimiento la fila es por sede (PK `establecimiento_id`);
    acá se siembra la de la sede principal. Una base vieja todavía puede tener
    la PK `id` hasta que `migrar_establecimientos` reconstruye la tabla.
    """
    columna = "establecimiento_id" if "establecimiento_id" in columnas_de("configuracion_vista_publica") else "id"
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "INSERT OR IGNORE INTO configuracion_vista_publica "
                f"({columna}, habilitada, codigo_publico) VALUES (1, 0, NULL)"
            )
        )
