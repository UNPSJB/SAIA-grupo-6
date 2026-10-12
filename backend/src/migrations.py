import logging

from sqlalchemy import inspect, text

import src.all_models  # noqa: F401  (registra todos los modelos)
from src.database import engine
from src.models import ModeloBase

logger = logging.getLogger(__name__)


def _columnas_de(inspector, tabla: str) -> set:
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def _marcar_migracion(clave: str) -> None:
    """Registra que una migración de una sola vez ya corrió."""
    with engine.begin() as conexion:
        conexion.execute(
            text("INSERT OR IGNORE INTO schema_migrations (clave) VALUES (:clave)"),
            {"clave": clave},
        )


def _migracion_ya_corrio(clave: str) -> bool:
    inspector = inspect(engine)
    if "schema_migrations" not in set(inspector.get_table_names()):
        return False
    with engine.begin() as conexion:
        return (
            conexion.execute(
                text("SELECT 1 FROM schema_migrations WHERE clave = :clave"),
                {"clave": clave},
            ).scalar_one_or_none()
            is not None
        )


def run_migrations() -> None:
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())

    # Bitácora de las migraciones que no deben repetirse.
    if "schema_migrations" not in tablas:
        logger.info("Migración: creando la tabla schema_migrations")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS schema_migrations ("
                    "clave TEXT PRIMARY KEY, "
                    "aplicada_en DATETIME DEFAULT CURRENT_TIMESTAMP)"
                )
            )

    if "personal" in tablas and "es_super_admin" not in _columnas_de(inspector, "personal"):
        logger.info("Migración: agregando columna personal.es_super_admin")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "ALTER TABLE personal "
                    "ADD COLUMN es_super_admin BOOLEAN NOT NULL DEFAULT 0"
                )
            )

    if "versiones_documento" in tablas:
        columnas = _columnas_de(inspect(engine), "versiones_documento")

        if "fecha_vencimiento" not in columnas:
            logger.info(
                "Migración: agregando columna "
                "versiones_documento.fecha_vencimiento"
            )

            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE versiones_documento "
                        "ADD COLUMN fecha_vencimiento DATE"
                    )
                )

    if "incidentes" in tablas:
        columnas = _columnas_de(inspector, "incidentes")

        if "estado" not in columnas:
            logger.info("Migración: agregando columna incidentes.estado")
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE incidentes "
                        "ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'abierto'"
                    )
                )

            # Los que estaban dados de baja (activo = 0) pasan a cerrado.
            if "activo" in columnas:
                with engine.begin() as conexion:
                    actualizados = conexion.execute(
                        text(
                            "UPDATE incidentes SET estado = 'cerrado' "
                            "WHERE activo = 0"
                        )
                    ).rowcount
                if actualizados:
                    logger.info(
                        "Migración: %s incidentes dados de baja quedaron como "
                        "cerrados.",
                        actualizados,
                    )

        if "fecha_cierre" not in columnas:
            logger.info("Migración: agregando columna incidentes.fecha_cierre")
            with engine.begin() as conexion:
                conexion.execute(
                    text("ALTER TABLE incidentes ADD COLUMN fecha_cierre DATETIME")
                )

        if "observacion_cierre" not in columnas:
            logger.info(
                "Migración: agregando columna incidentes.observacion_cierre"
            )
            with engine.begin() as conexion:
                conexion.execute(
                    text("ALTER TABLE incidentes ADD COLUMN observacion_cierre TEXT")
                )

        if "responsable_cierre_id" not in columnas:
            logger.info(
                "Migración: agregando columna incidentes.responsable_cierre_id"
            )
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE incidentes "
                        "ADD COLUMN responsable_cierre_id INTEGER "
                        "REFERENCES personal(id)"
                    )
                )


        if "activo" in _columnas_de(inspector, "incidentes"):
            logger.info("Migración: eliminando columna incidentes.activo")
            with engine.begin() as conexion:
                conexion.execute(text("ALTER TABLE incidentes DROP COLUMN activo"))

    if "incidentes" in tablas and "titulo" not in _columnas_de(inspector, "incidentes"):
        logger.info("Migración: agregando columna incidentes.titulo")
        with engine.begin() as conexion:
            conexion.execute(
                text("ALTER TABLE incidentes ADD COLUMN titulo VARCHAR(60)")
            )

            conexion.execute(
                text(
                    "UPDATE incidentes SET titulo = "
                    "CASE WHEN descripcion IS NULL OR TRIM(descripcion) = '' "
                    "THEN 'Incidente sin título' "
                    "ELSE SUBSTR(TRIM(descripcion), 1, 60) END "
                    "WHERE titulo IS NULL"
                )
            )


    if (
        "registro_tareas" in tablas
        and "elemento_limpieza_id" not in _columnas_de(inspector, "registro_tareas")
    ):
        logger.info(
            "Migración: agregando columna registro_tareas.elemento_limpieza_id"
        )
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "ALTER TABLE registro_tareas "
                    "ADD COLUMN elemento_limpieza_id INTEGER "
                    "REFERENCES elementos_limpieza(id) ON DELETE SET NULL"
                )
            )


    if "equipos" in tablas and "frecuencia_calibracion_dias" not in _columnas_de(
        inspector, "equipos"
    ):
        logger.info(
            "Migración: agregando columna equipos.frecuencia_calibracion_dias"
        )
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "ALTER TABLE equipos "
                    "ADD COLUMN frecuencia_calibracion_dias INTEGER"
                )
            )

    if (
        "calibraciones" in tablas
        and "activo" in _columnas_de(inspector, "calibraciones")
    ):
        logger.info("Migración: eliminando columna calibraciones.activo")
        with engine.begin() as conexion:
            conexion.execute(
                text("ALTER TABLE calibraciones DROP COLUMN activo")
            )

    if "tareas" in tablas:
        columnas = _columnas_de(inspector, "tareas")

        if "tipo" not in columnas:
            logger.info("Migración: agregando columna tareas.tipo")
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE tareas "
                        "ADD COLUMN tipo VARCHAR(30) NOT NULL DEFAULT 'operacional'"
                    )
                )

        if "observaciones" not in columnas:
            logger.info("Migración: agregando columna tareas.observaciones")
            with engine.begin() as conexion:
                conexion.execute(
                    text("ALTER TABLE tareas ADD COLUMN observaciones TEXT")
                )

    if "registro_tareas" in tablas:
        columnas = _columnas_de(inspector, "registro_tareas")

        if "tipo_tarea_historico" not in columnas:
            logger.info(
                "Migración: agregando columna registro_tareas.tipo_tarea_historico"
            )
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE registro_tareas "
                        "ADD COLUMN tipo_tarea_historico VARCHAR(30)"
                    )
                )

        if "observaciones_tarea_historico" not in columnas:
            logger.info(
                "Migración: agregando columna "
                "registro_tareas.observaciones_tarea_historico"
            )
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE registro_tareas "
                        "ADD COLUMN observaciones_tarea_historico TEXT"
                    )
                )


    if _migracion_ya_corrio("bootstrap_super_admin"):
        return

    promovido = None
    motivo = ""

    with engine.begin() as conexion:
        total = conexion.execute(text("SELECT COUNT(*) FROM personal")).scalar_one()
        ya_hay_super = conexion.execute(
            text("SELECT COUNT(*) FROM personal WHERE es_super_admin = 1")
        ).scalar_one()
        ya_hay_admin = conexion.execute(
            text(
                "SELECT COUNT(*) FROM personal "
                "WHERE puede_administrar = 1 OR es_super_admin = 1"
            )
        ).scalar_one()

        if total > 0 and ya_hay_super == 0:
            if ya_hay_admin > 0:
                consulta = (
                    "SELECT id FROM personal "
                    "WHERE puede_administrar = 1 ORDER BY id LIMIT 1"
                )
                motivo = "no existía ningún super admin"
            else:
                consulta = (
                    "SELECT id FROM personal "
                    "WHERE activo = 1 ORDER BY id LIMIT 1"
                )
                motivo = "no existía ningún administrador en la base"

            candidato = conexion.execute(text(consulta)).scalar_one_or_none()

            if candidato is not None:
                conexion.execute(
                    text("UPDATE personal SET es_super_admin = 1 WHERE id = :id"),
                    {"id": candidato},
                )
                promovido = candidato

    if promovido is not None:
        _marcar_migracion("bootstrap_super_admin")
        logger.warning(
            "Bootstrap: el usuario %s fue promovido a super admin (%s).",
            promovido,
            motivo,
        )


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()
