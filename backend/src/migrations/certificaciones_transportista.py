"""Migración de la tabla certificaciones_transportista.

Crea la tabla con el esquema completo si aún no existe. Idempotente.
"""

import logging

from sqlalchemy import text

from src.common.texto import normalizar_texto
from src.database import engine
from .base import (
    agregar_columna,
    crear_bitacora,
    columnas_de,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "certificaciones_transportista_tabla_inicial"
CLAVE_TRAZABILIDAD = "certificaciones_transportista_trazabilidad"


def _tabla_existe() -> bool:
    return "certificaciones_transportista" in tablas()


def _columnas_existentes() -> set[str]:
    return columnas_de("certificaciones_transportista")


def crear_tabla_certificaciones_transportista() -> None:
    """Crea la tabla `certificaciones_transportista` si aún no existe."""
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE TABLE IF NOT EXISTS certificaciones_transportista ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "transportista_id INTEGER NOT NULL REFERENCES transportistas(id) ON DELETE CASCADE, "
                "tipo VARCHAR(100) NOT NULL, "
                "numero VARCHAR(100) NOT NULL, "
                "fecha_emision DATE NOT NULL, "
                "fecha_vencimiento DATE NOT NULL, "
                "observaciones TEXT, "
                "archivo_url VARCHAR(500), "
                "activa BOOLEAN NOT NULL DEFAULT 1, "
                "fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                "fecha_actualizacion DATETIME)"
            )
        )
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_certificaciones_transportista_transportista_id "
                "ON certificaciones_transportista (transportista_id)"
            )
        )
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_certificaciones_transportista_activa "
                "ON certificaciones_transportista (activa)"
            )
        )


def migrar_certificaciones_transportista() -> None:
    """Aplica la migración de la tabla certificaciones_transportista."""
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if not _tabla_existe():
        logger.info("Migración: creando tabla certificaciones_transportista")
        crear_tabla_certificaciones_transportista()
    else:
        columnas = _columnas_existentes()
        logger.info(
            "Migración: tabla certificaciones_transportista ya existe, columnas=%s",
            columnas,
        )

        # Agregar columnas que falten
        definiciones = {
            "transportista_id": "INTEGER NOT NULL",
            "tipo": "VARCHAR(100) NOT NULL",
            "numero": "VARCHAR(100) NOT NULL",
            "fecha_emision": "DATE NOT NULL",
            "fecha_vencimiento": "DATE NOT NULL",
            "observaciones": "TEXT",
            "archivo_url": "VARCHAR(500)",
            "activa": "BOOLEAN NOT NULL DEFAULT 1",
            "fecha_creacion": "DATETIME",
            "fecha_actualizacion": "DATETIME",
        }
        for columna, definicion in definiciones.items():
            if columna not in columnas:
                logger.info(
                    "Migración: agregando columna certificaciones_transportista.%s",
                    columna,
                )
                with engine.begin() as conexion:
                    conexion.execute(
                        text(
                            f"ALTER TABLE certificaciones_transportista ADD COLUMN {columna} {definicion}"
                        )
                    )

        # Crear índices si faltan
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_certificaciones_transportista_transportista_id "
                    "ON certificaciones_transportista (transportista_id)"
                )
            )
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_certificaciones_transportista_activa "
                    "ON certificaciones_transportista (activa)"
                )
            )

    marcar_migracion(CLAVE)


def _normalizar_tipo_migracion(tipo: str | None) -> str:
    return normalizar_texto(" ".join((tipo or "").split()))


def _completar_tipo_normalizado() -> None:
    """Calcula `tipo_normalizado` para las certificaciones que ya existían."""
    with engine.begin() as conexion:
        filas = conexion.execute(
            text(
                "SELECT id, tipo FROM certificaciones_transportista "
                "WHERE tipo_normalizado IS NULL OR tipo_normalizado = ''"
            )
        ).all()
        for id_, tipo in filas:
            conexion.execute(
                text(
                    "UPDATE certificaciones_transportista "
                    "SET tipo_normalizado = :valor WHERE id = :id"
                ),
                {"valor": _normalizar_tipo_migracion(tipo), "id": id_},
            )


def _resolver_activas_duplicadas() -> None:
    """Deja una sola activa por transportista y tipo normalizado.

    La versión anterior comparaba el `tipo` tal cual estaba escrito, así que
    podían existir dos activas equivalentes ("SENASA" y "senasa "). Se conserva
    la de vencimiento más lejano (y, a igualdad, la más nueva) y el resto pasa
    a historial como "Reemplazada".
    """
    with engine.begin() as conexion:
        filas = conexion.execute(
            text(
                "SELECT id, transportista_id, tipo_normalizado "
                "FROM certificaciones_transportista "
                "WHERE activa = 1 "
                "ORDER BY fecha_vencimiento DESC, id DESC"
            )
        ).all()

        vistas: set[tuple[int, str]] = set()
        for id_, transportista_id, tipo_normalizado in filas:
            clave = (transportista_id, tipo_normalizado)
            if clave in vistas:
                conexion.execute(
                    text(
                        "UPDATE certificaciones_transportista "
                        "SET activa = 0 WHERE id = :id"
                    ),
                    {"id": id_},
                )
            else:
                vistas.add(clave)


def _crear_indice_unico_activa() -> None:
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_certificaciones_transportista_tipo_activa "
                "ON certificaciones_transportista (transportista_id, tipo_normalizado) "
                "WHERE activa = 1"
            )
        )


def migrar_certificaciones_transportista_trazabilidad() -> None:
    """Agrega los campos de trazabilidad y el índice único parcial.

    Es una migración aparte de la inicial a propósito: en bases que ya tienen
    la tabla, la migración inicial no vuelve a correr y las columnas nuevas
    nunca se agregarían.
    """
    crear_bitacora()
    if migracion_ya_corrio(CLAVE_TRAZABILIDAD):
        return

    if not _tabla_existe():
        # La migración inicial (que corre antes) se encarga de crearla.
        marcar_migracion(CLAVE_TRAZABILIDAD)
        return

    definiciones = {
        "tipo_normalizado": "VARCHAR(100)",
        "anulada": "BOOLEAN NOT NULL DEFAULT 0",
        "motivo_anulacion": "TEXT",
        "anulada_por": "INTEGER",
        "fecha_anulacion": "DATETIME",
    }
    for columna, definicion in definiciones.items():
        agregar_columna("certificaciones_transportista", columna, definicion)

    _completar_tipo_normalizado()
    _resolver_activas_duplicadas()
    _crear_indice_unico_activa()
    marcar_migracion(CLAVE_TRAZABILIDAD)
