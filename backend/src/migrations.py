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

    # Instalaciones creadas antes del informe de consumo tienen la tabla pero
    # no estas dos columnas: create_all no altera tablas existentes.
    if "registro_tareas" in tablas:
        columnas = _columnas_de(inspect(engine), "registro_tareas")
        if "insumo_quimico_id" not in columnas:
            logger.info("Migración: agregando columna registro_tareas.insumo_quimico_id")
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE registro_tareas "
                        "ADD COLUMN insumo_quimico_id INTEGER "
                        "REFERENCES insumos_quimicos(id) ON DELETE SET NULL"
                    )
                )
        if "cantidad_consumida" not in columnas:
            logger.info("Migración: agregando columna registro_tareas.cantidad_consumida")
            with engine.begin() as conexion:
                conexion.execute(
                    text("ALTER TABLE registro_tareas ADD COLUMN cantidad_consumida FLOAT")
                )
        if "version_stock" not in columnas:
            logger.info("Migración: agregando columna registro_tareas.version_stock")
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE registro_tareas "
                        "ADD COLUMN version_stock INTEGER NOT NULL DEFAULT 0"
                    )
                )

    # Los productos que ya existían empiezan explícitamente con saldo cero.
    # No se reconstruye ni descuenta el histórico de checklist: esa información
    # no representa una carga inicial verificable.
    if "insumos_quimicos" in tablas and "stock_insumos_quimicos" in tablas:
        with engine.begin() as conexion:
            creados = conexion.execute(
                text(
                    "INSERT OR IGNORE INTO stock_insumos_quimicos "
                    "(insumo_quimico_id, cantidad_actual, actualizado_en) "
                    "SELECT id, 0, CURRENT_TIMESTAMP FROM insumos_quimicos"
                )
            ).rowcount
        if creados:
            logger.info("Migración: se inicializaron %s saldos de productos químicos.", creados)

    # Las tablas nuevas se crean con metadata.create_all() antes de esta función.
    # Estos índices se aseguran de forma idempotente para bases ya existentes.
    if "lotes_stock" in tablas:
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_lotes_stock_proveedor_insumo_lote "
                    "ON lotes_stock (proveedor_id, insumo_quimico_id, numero_lote)"
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

    # 6) Calibraciones: tipo de intervención.
    #
    #    La tabla se conserva para no perder el historial existente: al agregar
    #    la columna con este default, cada registro previo queda identificado
    #    como una calibración. La restricción coincide con el modelo y evita
    #    nuevos valores ajenos a los dos tipos de intervención admitidos.
    if "calibraciones" in tablas:
        columnas = _columnas_de(inspector, "calibraciones")
        if "tipo" not in columnas:
            logger.info("Migración: agregando columna calibraciones.tipo")
            with engine.begin() as conexion:
                conexion.execute(
                    text(
                        "ALTER TABLE calibraciones "
                        "ADD COLUMN tipo VARCHAR(20) NOT NULL "
                        "DEFAULT 'calibracion' "
                        "CHECK (tipo IN ('calibracion', 'mantenimiento'))"
                    )
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

    # 7) Tareas: tipo (preoperacional/operacional/postoperacional) y
    #    observaciones del administrador.
    #
    #    `tipo` es NOT NULL con default: las tareas que ya existían quedan como
    #    operacionales (el default histórico). `observaciones` es texto libre.
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

    # 8) Registro de tareas: congelado del tipo y las observaciones.
    #
    #    El checklist es una foto de la tarea al generarse; las filas viejas
    #    no tienen el dato, por eso las columnas quedan en NULL (a diferencia
    #    de `tareas.tipo`, acá no se puede inventar un valor del pasado).
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

    # 9) Bootstrap del primer super admin.
    #
    #    Antes corría en cada arranque: un super admin que se degradaba a
    #    propósito (para pasar el control) volvía a ser promovido en el
    #    siguiente reinicio, y degradar era imposible sin editar la base a mano.
    #    Ahora es de una sola vez, con bitácora en `schema_migrations`.
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
