"""Migración del circuito de rechazos de salidas (SQLite, idempotente).

Agrega a `salidas` los campos del rechazo y de su disposición, y a
`incidentes` los vínculos opcionales con el lote y la salida.

Además actualiza el CHECK de `salidas.estado` para admitir `RECHAZADA`. SQLite
no permite modificar una restricción existente, así que cuando hace falta se
reconstruye la tabla siguiendo el procedimiento recomendado: se crea una tabla
nueva con el mismo DDL (parcheado), se copian las filas, se elimina la vieja y
se renombra. Sin backfill: todas las columnas nuevas quedan en NULL.

El tipo de incidente "Entrega rechazada" no necesita migración: los tipos son
una lista fija (`TipoIncidente`), no un catálogo editable en la base.
"""

import logging
import re

from sqlalchemy import text

from src.database import engine

from .base import (
    agregar_columna,
    columnas_de,
    crear_bitacora,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "salidas_rechazo"

_COLUMNAS_SALIDAS = {
    "motivo_rechazo": "VARCHAR(50)",
    "detalle_rechazo": "VARCHAR(500)",
    "fecha_rechazo": "DATE",
    "rechazada_por_id": "INTEGER REFERENCES personal(id)",
    "disposicion": "VARCHAR(20)",
    "justificacion_disposicion": "VARCHAR(500)",
    "fecha_disposicion": "DATETIME",
    "decidida_por_id": "INTEGER REFERENCES personal(id)",
    "incidente_id": "INTEGER REFERENCES incidentes(id) ON DELETE SET NULL",
}

_COLUMNAS_INCIDENTES = {
    "lote_id": "INTEGER REFERENCES lotes_producto(id) ON DELETE SET NULL",
    # Sin FK declarada a propósito: `salidas.incidente_id` ya apunta para el
    # otro lado y dos FK cruzadas no se pueden ordenar al crear las tablas.
    "salida_id": "INTEGER",
}

# Índices que tenía `salidas` (se pierden al reconstruir la tabla) más el del
# incidente vinculado.
_INDICES_SALIDAS = (
    ("ix_salidas_id", "id"),
    ("ix_salidas_lote_id", "lote_id"),
    ("ix_salidas_cliente_id", "cliente_id"),
    ("ix_salidas_estado", "estado"),
    ("ix_salidas_incidente_id", "incidente_id"),
)

_INDICES_INCIDENTES = (
    ("ix_incidentes_lote_id", "lote_id"),
    ("ix_incidentes_salida_id", "salida_id"),
)


def _ddl_salidas(cursor) -> str | None:
    fila = cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'salidas'"
    ).fetchone()
    return fila[0] if fila else None


def _reconstruir_salidas() -> None:
    """Recrea `salidas` con el CHECK de estado que admite RECHAZADA."""
    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        # Fuera de transacción: el PRAGMA no tiene efecto dentro de una.
        cursor.execute("PRAGMA foreign_keys=OFF")

        ddl = _ddl_salidas(cursor)
        if ddl is None or "RECHAZADA" in ddl:
            cursor.execute("PRAGMA foreign_keys=ON")
            return

        columnas = [fila[1] for fila in cursor.execute("PRAGMA table_info('salidas')")]
        ddl_nueva = re.sub(
            r"CREATE\s+TABLE\s+[\"']?salidas[\"']?",
            "CREATE TABLE salidas_nueva",
            ddl,
            count=1,
            flags=re.IGNORECASE,
        )
        ddl_nueva, reemplazos = re.subn(
            r"(CHECK\s*\(\s*estado\s+IN\s*\([^)]*)\)",
            r"\1, 'RECHAZADA')",
            ddl_nueva,
            flags=re.IGNORECASE,
        )
        if reemplazos != 1:
            raise RuntimeError(
                "No se pudo actualizar el CHECK de salidas.estado: "
                f"se esperaba una restricción y se encontraron {reemplazos}."
            )

        logger.info("Migración: reconstruyendo salidas para admitir RECHAZADA")
        cursor.execute("DROP TABLE IF EXISTS salidas_nueva")
        cursor.execute(ddl_nueva)

        lista_columnas = ", ".join(f'"{columna}"' for columna in columnas)
        cursor.execute(
            f"INSERT INTO salidas_nueva ({lista_columnas}) "
            f"SELECT {lista_columnas} FROM salidas"
        )
        cursor.execute("DROP TABLE salidas")
        cursor.execute("ALTER TABLE salidas_nueva RENAME TO salidas")

        for nombre, columna in _INDICES_SALIDAS:
            cursor.execute(
                f'CREATE INDEX IF NOT EXISTS "{nombre}" ON salidas ("{columna}")'
            )

        raw.commit()
        cursor.execute("PRAGMA foreign_keys=ON")
    except Exception:
        raw.rollback()
        raise
    finally:
        raw.close()


def _crear_indices_incidentes() -> None:
    with engine.begin() as conexion:
        for nombre, columna in _INDICES_INCIDENTES:
            conexion.execute(
                text(
                    f'CREATE INDEX IF NOT EXISTS "{nombre}" '
                    f'ON incidentes ("{columna}")'
                )
            )


def migrar_salidas_rechazo() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "salidas" in tablas():
        columnas_actuales = columnas_de("salidas")
        for columna, definicion in _COLUMNAS_SALIDAS.items():
            if columna not in columnas_actuales:
                agregar_columna("salidas", columna, definicion)
        _reconstruir_salidas()

    if "incidentes" in tablas():
        columnas_actuales = columnas_de("incidentes")
        for columna, definicion in _COLUMNAS_INCIDENTES.items():
            if columna not in columnas_actuales:
                agregar_columna("incidentes", columna, definicion)
        _crear_indices_incidentes()

    marcar_migracion(CLAVE)
