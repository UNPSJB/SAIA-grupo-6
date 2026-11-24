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

    _reclasificar_devoluciones()


def _reclasificar_devoluciones() -> None:
    """El tipo "Devolución de cliente" se eliminó: lo cubren reclamos y rechazos.

    Los que había pasan a "Otro" (no tienen cliente ni salida con qué armar un
    reclamo) y la descripción conserva el tipo con el que se registraron.
    Idempotente: después de la primera vez no queda ninguno.
    """
    with engine.begin() as conexion:
        cambiados = conexion.execute(
            text(
                "UPDATE incidentes SET tipo = 'otro', descripcion = descripcion || :nota "
                "WHERE tipo = 'devolucion_cliente'"
            ),
            {"nota": "\n\n(Registrado originalmente como Devolución de cliente.)"},
        ).rowcount
    if cambiados:
        logger.info(
            "Migración: %s incidentes de devolución de cliente pasaron a Otro.",
            cambiados,
        )
