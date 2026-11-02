import logging

from sqlalchemy import text

from src.database import engine

from .base import agregar_columna, columnas_de, tablas

logger = logging.getLogger(__name__)


def migrar_incidentes() -> None:
    if "incidentes" not in tablas():
        return

    tenia_activo = "activo" in columnas_de("incidentes")

    if agregar_columna(
        "incidentes", "estado", "VARCHAR(20) NOT NULL DEFAULT 'abierto'"
    ) and tenia_activo:
        # Los que estaban dados de baja (activo = 0) pasan a cerrado.
        with engine.begin() as conexion:
            actualizados = conexion.execute(
                text("UPDATE incidentes SET estado = 'cerrado' WHERE activo = 0")
            ).rowcount
        if actualizados:
            logger.info(
                "Migración: %s incidentes dados de baja quedaron como cerrados.",
                actualizados,
            )

    agregar_columna("incidentes", "fecha_cierre", "DATETIME")
    agregar_columna("incidentes", "observacion_cierre", "TEXT")
    agregar_columna(
        "incidentes",
        "responsable_cierre_id",
        "INTEGER REFERENCES personal(id)",
    )

    if tenia_activo:
        logger.info("Migración: eliminando columna incidentes.activo")
        with engine.begin() as conexion:
            conexion.execute(text("ALTER TABLE incidentes DROP COLUMN activo"))

    if agregar_columna("incidentes", "titulo", "VARCHAR(60)"):
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "UPDATE incidentes SET titulo = "
                    "CASE WHEN descripcion IS NULL OR TRIM(descripcion) = '' "
                    "THEN 'Incidente sin título' "
                    "ELSE SUBSTR(TRIM(descripcion), 1, 60) END "
                    "WHERE titulo IS NULL"
                )
            )
