"""Migración de la tabla transportistas.

Crea la tabla `transportistas` con el esquema completo si aún no existe.
Todo es idempotente: se puede ejecutar varias veces sin error.
"""

import logging

from sqlalchemy import text

from src.database import engine
from .base import (
    crear_bitacora,
    columnas_de,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "transportistas_tabla_inicial"


def _tabla_existe() -> bool:
    return "transportistas" in tablas()


def _columnas_existentes() -> set[str]:
    return columnas_de("transportistas")


def crear_tabla_transportistas() -> None:
    """Crea la tabla `transportistas` con el esquema actual si aún no existe."""
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE TABLE IF NOT EXISTS transportistas ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "razon_social VARCHAR(200) NOT NULL, "
                "cuit VARCHAR(20) NOT NULL UNIQUE, "
                "telefono VARCHAR(30) NOT NULL, "
                "email VARCHAR(200), "
                "domicilio VARCHAR(200), "
                "observaciones TEXT, "
                "activo BOOLEAN NOT NULL DEFAULT 1, "
                "fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "fecha_actualizacion DATETIME)"
            )
        )
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_transportistas_razon_social "
                "ON transportistas (razon_social)"
            )
        )
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_transportistas_cuit "
                "ON transportistas (cuit)"
            )
        )


def migrar_transportistas() -> None:
    """Aplica la migración de la tabla transportistas."""
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if not _tabla_existe():
        logger.info("Migración: creando tabla transportistas")
        crear_tabla_transportistas()
    else:
        columnas = _columnas_existentes()
        logger.info("Migración: tabla transportistas ya existe, columnas=%s", columnas)

        # Agregar columnas que falten de forma idempotente
        definiciones = {
            "razon_social": "VARCHAR(200) NOT NULL DEFAULT ''",
            "cuit": "VARCHAR(20) NOT NULL DEFAULT ''",
            "telefono": "VARCHAR(30) NOT NULL DEFAULT ''",
            "email": "VARCHAR(200)",
            "domicilio": "VARCHAR(200)",
            "observaciones": "TEXT",
            "activo": "BOOLEAN NOT NULL DEFAULT 1",
            "fecha_creacion": "DATETIME",
            "fecha_actualizacion": "DATETIME",
        }
        for columna, definicion in definiciones.items():
            if columna not in columnas:
                logger.info("Migración: agregando columna %s.%s", "transportistas", columna)
                with engine.begin() as conexion:
                    conexion.execute(
                        text(
                            f"ALTER TABLE transportistas ADD COLUMN {columna} {definicion}"
                        )
                    )

        # Crear índices si faltan
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_transportistas_razon_social "
                    "ON transportistas (razon_social)"
                )
            )
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_transportistas_cuit "
                    "ON transportistas (cuit)"
                )
            )

    marcar_migracion(CLAVE)
