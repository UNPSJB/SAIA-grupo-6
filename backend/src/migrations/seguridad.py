"""Tablas de seguridad: rate limiting compartido por IP y DNI, y rotación
atómica de refresh tokens. Se usa CREATE TABLE IF NOT EXISTS para que sea
idempotente y no falle si create_all ya las creó."""

import logging

from sqlalchemy import text

from src.database import engine

from .base import tablas

logger = logging.getLogger(__name__)


def migrar_seguridad() -> None:
    existentes = tablas()

    if "refresh_tokens" not in existentes:
        logger.info("Migración: creando tabla refresh_tokens")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS refresh_tokens ("
                    "jti VARCHAR(64) NOT NULL PRIMARY KEY, "
                    "usuario_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE, "
                    "familia VARCHAR(64) NOT NULL, "
                    "usado BOOLEAN NOT NULL DEFAULT 0, "
                    "expira DATETIME NOT NULL, "
                    "creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"
                )
            )
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_usuario_id "
                    "ON refresh_tokens (usuario_id)"
                )
            )
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_familia "
                    "ON refresh_tokens (familia)"
                )
            )

    if "intentos_login" not in existentes:
        logger.info("Migración: creando tabla intentos_login")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS intentos_login ("
                    "ip VARCHAR(45) NOT NULL, "
                    "dni VARCHAR(8) NOT NULL, "
                    "ultimo_intento DATETIME NOT NULL, "
                    "contador INTEGER NOT NULL DEFAULT 0, "
                    "bloqueado_hasta DATETIME, "
                    "PRIMARY KEY (ip, dni))"
                )
            )
