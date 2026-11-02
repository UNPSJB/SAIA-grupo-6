"""Migración de bootstrap para la tabla de configuración de vista pública.

La tabla se crea con `metadata.create_all()` antes de `run_migrations()`.
Esta migración asegura que exista una única fila persistida con la vista
pública desactivada (opt-in), de forma idempotente.
"""

from src.database import engine
from sqlalchemy import text


def migrar_vista_publica() -> None:
    """Inserta la fila inicial de configuración de vista pública si falta."""
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "INSERT OR IGNORE INTO configuracion_vista_publica "
                "(id, habilitada, codigo_publico) VALUES (1, 0, NULL)"
            )
        )
