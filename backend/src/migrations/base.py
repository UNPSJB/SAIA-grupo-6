"""Utilidades compartidas por las migraciones (SQL crudo específico de SQLite)."""

import logging

from sqlalchemy import inspect, text

from src.database import engine

logger = logging.getLogger(__name__)


def tablas() -> set[str]:
    """Tablas existentes ahora mismo (se consulta cada vez: no se cachea)."""
    return set(inspect(engine).get_table_names())


def columnas_de(tabla: str) -> set[str]:
    return {columna["name"] for columna in inspect(engine).get_columns(tabla)}


def hay_insumos_viejo() -> bool:
    """True si existe la tabla `insumos` del esquema viejo.

    Hasta 2026-11 `insumos` era el maestro que hoy se llama `ingredientes`.
    Ahora `insumos` es otra tabla (la marca comprada, con `ingrediente_id`):
    las migraciones legadas que trabajaban sobre el maestro viejo tienen que
    reconocerlo por sus columnas, no por el nombre, para no tocar la nueva.
    """
    return "insumos" in tablas() and "ingrediente_id" not in columnas_de("insumos")


def agregar_columna(tabla: str, columna: str, definicion: str) -> bool:
    """Agrega la columna si falta. Devuelve True si la agregó."""
    if columna in columnas_de(tabla):
        return False
    logger.info("Migración: agregando columna %s.%s", tabla, columna)
    with engine.begin() as conexion:
        conexion.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}"))
    return True


def crear_bitacora() -> None:
    """Bitácora de las migraciones de una sola vez."""
    if "schema_migrations" in tablas():
        return
    logger.info("Migración: creando la tabla schema_migrations")
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "clave TEXT PRIMARY KEY, "
                "aplicada_en DATETIME DEFAULT CURRENT_TIMESTAMP)"
            )
        )


def marcar_migracion(clave: str) -> None:
    """Registra que una migración de una sola vez ya corrió."""
    with engine.begin() as conexion:
        conexion.execute(
            text("INSERT OR IGNORE INTO schema_migrations (clave) VALUES (:clave)"),
            {"clave": clave},
        )


def migracion_ya_corrio(clave: str) -> bool:
    if "schema_migrations" not in tablas():
        return False
    with engine.begin() as conexion:
        return (
            conexion.execute(
                text("SELECT 1 FROM schema_migrations WHERE clave = :clave"),
                {"clave": clave},
            ).scalar_one_or_none()
            is not None
        )
