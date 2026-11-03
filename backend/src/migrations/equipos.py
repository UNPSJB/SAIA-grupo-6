import logging

from sqlalchemy import inspect, text

from src.database import engine

from .base import agregar_columna, columnas_de, tablas
from .equipos_sectores import migrar_equipos_a_sectores, sector_id_conforme

logger = logging.getLogger(__name__)


def migrar_equipos() -> None:
    if "equipos" in tablas():
        agregar_columna("equipos", "frecuencia_calibracion_dias", "INTEGER")

    migrar_calibraciones()
    vincular_equipos_con_sectores()


def migrar_calibraciones() -> None:
    """Calibraciones: tipo de intervención y baja lógica.

    La tabla se conserva para no perder el historial: al agregar `tipo` con su
    default, cada registro previo queda como una calibración. La restricción
    coincide con el modelo y evita valores ajenos a los dos tipos admitidos.

    `activo` es el borrado lógico que declara el modelo `Calibracion`; las
    filas existentes quedan como activas.
    """
    if "calibraciones" not in tablas():
        return

    if "tipo" not in columnas_de("calibraciones"):
        agregar_columna(
            "calibraciones",
            "tipo",
            "VARCHAR(20) NOT NULL DEFAULT 'calibracion' "
            "CHECK (tipo IN ('calibracion', 'mantenimiento'))",
        )
    else:
        # Protege instalaciones que hubieran agregado la columna antes de
        # esta migración sin valor para filas históricas.
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "UPDATE calibraciones SET tipo = 'calibracion' "
                    "WHERE tipo IS NULL OR TRIM(tipo) = ''"
                )
            )

    agregar_columna("calibraciones", "activo", "BOOLEAN NOT NULL DEFAULT 1")


def vincular_equipos_con_sectores() -> None:
    """Equipos: la ubicación pasó a ser su propia entidad (`sectores`).

    El modelo de equipos usa `sector_id` en vez de `ubicacion`, pero
    `create_all` no altera tablas existentes: una base anterior quedaba sin la
    columna y TODA consulta de equipos (y los listados que lo incluyen:
    checklist, incidentes, vencimientos) reventaba con
    "no such column: equipos.sector_id".

    La migración conserva los datos: cada ubicación usada se convierte en un
    sector y cada equipo queda asociado al suyo. La columna vieja `ubicacion`
    no se borra (SQLite la tolera; el ORM no la selecciona).
    """
    if "equipos" not in tablas():
        return

    if not sector_id_conforme(inspect(engine)):
        logger.info("Migración: vinculando equipos existentes con sectores")
        migrar_equipos_a_sectores()

    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_equipos_sector_id "
                "ON equipos (sector_id)"
            )
        )
