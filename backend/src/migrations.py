"""Migraciones ligeras para bases que ya existen.

`create_all()` crea las tablas faltantes pero NO agrega columnas a las que ya
existen. Sin esto, agregar un campo a un modelo (por ejemplo `es_super_admin`)
no se aplicaría sobre una base ya creada y la aplicación fallaría al consultar.
"""

import logging

from sqlalchemy import inspect, text

from src.database import engine
from src.models import ModeloBase

logger = logging.getLogger(__name__)


def _columnas_de(inspector, tabla: str) -> set:
    return {columna["name"] for columna in inspector.get_columns(tabla)}


def run_migrations() -> None:
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())

    # 1) Rol de super admin
    if "personal" in tablas and "es_super_admin" not in _columnas_de(inspector, "personal"):
        logger.info("Migración: agregando columna personal.es_super_admin")
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "ALTER TABLE personal "
                    "ADD COLUMN es_super_admin BOOLEAN NOT NULL DEFAULT 0"
                )
            )

    # 2) Incidentes: el estado abierto/cerrado reemplaza la baja lógica.
    #
    # Antes `activo` mezclaba dos cosas: "dado de baja" y "resuelto". Ahora hay
    # un `estado` explícito más la acción correctiva, la fecha de cierre y el
    # responsable de la resolución.
    #
    # El orden importa: primero se agrega `estado` y se rellena usando `activo`,
    # recién ahí se borra `activo`. Si se invirtiera, los incidentes que ya
    # estaban dados de baja quedarían marcados como abiertos.
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

        # `activo` es NOT NULL y sin default: si quedara en la tabla, los
        # INSERT futuros fallarían al no mandarlo. Por eso se elimina de verdad.
        if "activo" in _columnas_de(inspector, "incidentes"):
            logger.info("Migración: eliminando columna incidentes.activo")
            with engine.begin() as conexion:
                conexion.execute(text("ALTER TABLE incidentes DROP COLUMN activo"))

    # 3) Registro de tareas: elemento de limpieza utilizado.
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

    # 4) Bootstrap: si nadie es super admin, se promueve al administrador más
    #    antiguo. Si además no hay ningún administrador (base creada a mano o
    #    con puros operadores), se promueve al usuario activo más antiguo para
    #    que la instalación no quede sin quien pueda administrar los roles.
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
                logger.warning(
                    "Bootstrap: el usuario %s fue promovido a super admin (%s).",
                    candidato,
                    motivo,
                )


def crear_tablas_y_migrar() -> None:
    """Crea las tablas que faltan y aplica las migraciones de columnas."""
    ModeloBase.metadata.create_all(bind=engine)
    run_migrations()
