"""Migración de la tabla clientes.

La tabla `clientes` puede existir con el esquema anterior (columna `cuit`).
Esta migración:

1. Si la tabla no existe, la crea con el esquema actual (`documento` en vez de `cuit`,
   y columnas de auditoría `fecha_creacion` / `fecha_actualizacion`).
2. Si existe, renombra la columna `cuit` a `documento` y renombra el índice
   `ix_clientes_cuit` a `ix_clientes_documento`.
3. Agrega las columnas `fecha_creacion` y `fecha_actualizacion` si faltan.
4. Todo es idempotente: se puede ejecutar varias veces sin error.
"""

import logging

from sqlalchemy import inspect, text

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

CLAVE = "clientes_v2"


def _tabla_existe() -> bool:
    return "clientes" in tablas()


def _columnas_existentes() -> set[str]:
    return columnas_de("clientes")


def crear_tabla_clientes() -> None:
    """Crea la tabla `clientes` con el esquema actual si aún no existe."""
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE TABLE IF NOT EXISTS clientes ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "nombre VARCHAR(120) NOT NULL, "
                "documento VARCHAR(20) NOT NULL UNIQUE, "
                "telefono VARCHAR(30) NOT NULL, "
                "email VARCHAR(200), "
                "domicilio VARCHAR(200), "
                "activo BOOLEAN NOT NULL DEFAULT 1, "
                "fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "fecha_actualizacion DATETIME)"
            )
        )
        conexion.execute(
            text("CREATE INDEX IF NOT EXISTS ix_clientes_nombre ON clientes (nombre)")
        )
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_clientes_documento ON clientes (documento)"
            )
        )


def migrar_clientes() -> None:
    """Aplica la migración de la tabla clientes."""
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if not _tabla_existe():
        logger.info("Migración: creando tabla clientes")
        crear_tabla_clientes()
    else:
        columnas = _columnas_existentes()
        logger.info("Migración: tabla clientes ya existe, columnas=%s", columnas)

        # Renombrar columna cuit -> documento si es necesario
        if "cuit" in columnas and "documento" not in columnas:
            logger.info("Migración: renombrando columna cuit -> documento")
            with engine.begin() as conexion:
                conexion.execute(
                    text("ALTER TABLE clientes RENAME COLUMN cuit TO documento")
                )

        # Renombrar índice ix_clientes_cuit -> ix_clientes_documento si es necesario
        with engine.begin() as conexion:
            conexion.execute(
                text("DROP INDEX IF EXISTS ix_clientes_cuit")
            )
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_clientes_documento ON clientes (documento)"
                )
            )

        # Agregar columnas de auditoría si faltan.
        # SQLite no permite NOT NULL DEFAULT en ALTER TABLE, así que se agregan
        # como nullable; el modelo SQLAlchemy ya tiene server_default para nuevas filas.
        if "fecha_creacion" not in columnas:
            logger.info("Migración: agregando columna fecha_creacion")
            agregar_columna("clientes", "fecha_creacion", "DATETIME")

        if "fecha_actualizacion" not in columnas:
            logger.info("Migración: agregando columna fecha_actualizacion")
            agregar_columna("clientes", "fecha_actualizacion", "DATETIME")

    marcar_migracion(CLAVE)
