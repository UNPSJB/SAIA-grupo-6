"""Multiestablecimiento: la columna `establecimiento_id` en las tablas de sede.

`create_all` ya creó la tabla `establecimientos` (con la sede principal, ver
`src.establecimientos.models`) y las tablas nuevas con la columna. Acá se
agrega a las tablas que ya existían, y todos los datos previos quedan en el
establecimiento principal.

En las bases existentes la columna se agrega SIN la clave foránea: SQLite no
permite `ADD COLUMN ... REFERENCES` con un default distinto de NULL mientras
`foreign_keys` está activo. La integridad la sostiene el ORM (que sella la
sede en cada alta) y las bases nuevas sí tienen la FK.
"""

import logging

from sqlalchemy import text

from src.database import engine
from src.establecimientos.models import (
    ESTABLECIMIENTO_PRINCIPAL_ID,
    NOMBRE_ESTABLECIMIENTO_PRINCIPAL,
    _ConEstablecimiento,
)
from src.models import ModeloBase

from .base import agregar_columna, columnas_de, marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "multiestablecimiento_datos_previos"

# Configuraciones que eran de toda la instalación y pasan a ser una por sede
# (su PK pasa a incluir `establecimiento_id`, así que hay que reconstruirlas).
CONFIGURACIONES_POR_SEDE = (
    "configuracion_alertas",
    "configuracion_impacto",
    "configuracion_modulo_rotulado",
    "configuracion_observacion",
    "configuracion_vista_publica",
    "indicadores_vista_publica",
    "estado_notificaciones",
)


def tablas_de_sede() -> dict[str, bool]:
    """Tabla -> True si admite filas sin sede (personal, bitácora)."""
    return {
        mapper.local_table.name: bool(mapper.class_.__establecimiento_opcional__)
        for mapper in ModeloBase.registry.mappers
        if issubclass(mapper.class_, _ConEstablecimiento)
    }


def _reconstruir_con_sede(tabla: str) -> None:
    """Reconstruye una configuración con la PK nueva; lo previo va a la principal.

    SQLite no permite cambiar la PK con ALTER TABLE. Ninguna otra tabla apunta
    a estas, así que se puede renombrar, crear la nueva y copiar.
    """
    if "establecimiento_id" in columnas_de(tabla):
        return
    logger.info("Migración: %s pasa a ser una configuración por establecimiento", tabla)
    definicion = ModeloBase.metadata.tables[tabla]
    viejas = columnas_de(tabla)
    comunes = [c.name for c in definicion.columns if c.name in viejas]
    lista = ", ".join(comunes)
    viejo = f"{tabla}__previo_multisede"
    with engine.begin() as conexion:
        conexion.execute(text(f"ALTER TABLE {tabla} RENAME TO {viejo}"))
        # Los índices con nombre siguen colgados de la tabla renombrada y
        # chocarían con los de la nueva.
        for (indice,) in conexion.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = :t AND sql IS NOT NULL"),
            {"t": viejo},
        ):
            conexion.execute(text(f"DROP INDEX {indice}"))
        definicion.create(conexion)
        conexion.execute(
            text(
                f"INSERT INTO {tabla} (establecimiento_id, {lista}) "
                f"SELECT {ESTABLECIMIENTO_PRINCIPAL_ID}, {lista} FROM {viejo}"
            )
        )
        conexion.execute(text(f"DROP TABLE {viejo}"))


# Tablas cuyo único global era una restricción de la tabla (`unique=True` sin
# índice) y no un índice con nombre: para volverlo único por sede hay que
# reconstruir la tabla. (tabla, columna)
UNICOS_EN_LA_TABLA = (("elementos_limpieza", "nombre"),)


def _tiene_unico_de_tabla(cursor, tabla: str, columna: str) -> bool:
    for _seq, nombre, unico, origen, *_ in cursor.execute(f"PRAGMA index_list('{tabla}')").fetchall():
        if unico and origen == "u":
            columnas = [fila[2] for fila in cursor.execute(f"PRAGMA index_info('{nombre}')").fetchall()]
            if columnas == [columna]:
                return True
    return False


def _reconstruir_sin_unico_global(tabla: str, columna: str) -> None:
    """Recrea la tabla con la definición actual del modelo (único por sede).

    Es el procedimiento de SQLite para cambiar restricciones: con las FK
    apagadas (fuera de transacción) se crea la tabla nueva, se copian los
    datos, se borra la vieja y se renombra la nueva. Las tablas que la
    referencian por nombre siguen apuntando bien.
    """
    from sqlalchemy.schema import CreateIndex, CreateTable

    raw = engine.raw_connection()
    try:
        cursor = raw.cursor()
        if not _tiene_unico_de_tabla(cursor, tabla, columna):
            return
        logger.info("Migración: %s.%s pasa a ser único por establecimiento", tabla, columna)
        cursor.execute("PRAGMA foreign_keys=OFF")
        definicion = ModeloBase.metadata.tables[tabla]
        nueva = f"{tabla}__multisede"
        ddl = str(CreateTable(definicion).compile(engine)).replace(
            f"CREATE TABLE {tabla} ", f"CREATE TABLE {nueva} ", 1
        )
        viejas = {fila[1] for fila in cursor.execute(f"PRAGMA table_info('{tabla}')").fetchall()}
        lista = ", ".join(f'"{c.name}"' for c in definicion.columns if c.name in viejas)
        cursor.execute(f"DROP TABLE IF EXISTS {nueva}")
        cursor.execute(ddl)
        cursor.execute(f"INSERT INTO {nueva} ({lista}) SELECT {lista} FROM {tabla}")
        cursor.execute(f"DROP TABLE {tabla}")
        cursor.execute(f"ALTER TABLE {nueva} RENAME TO {tabla}")
        for indice in definicion.indexes:
            cursor.execute(str(CreateIndex(indice, if_not_exists=True).compile(engine)))
        raw.commit()
    except Exception:
        raw.rollback()
        raise
    finally:
        try:
            raw.cursor().execute("PRAGMA foreign_keys=ON")
        finally:
            raw.close()


def _indices_de(conexion, tabla: str) -> dict[str, bool]:
    """Nombre -> es único, de los índices actuales de la tabla."""
    return {fila[1]: bool(fila[2]) for fila in conexion.execute(text(f"PRAGMA index_list('{tabla}')"))}


def _unicos_por_sede(existentes: set[str]) -> None:
    """Los únicos globales (`ix_<tabla>_<col>` UNIQUE) pasan a ser por sede.

    Con `unique=True, index=True` SQLAlchemy había creado un índice único con
    nombre (no una restricción de la tabla), así que se puede borrar sin
    reconstruir: queda como índice común y se suma el único compuesto.
    """
    for definicion in ModeloBase.metadata.sorted_tables:
        if definicion.name not in existentes:
            continue
        for indice in definicion.indexes:
            columnas = [c.name for c in indice.columns]
            if not (indice.unique and "establecimiento_id" in columnas and indice.name.startswith("uq_")):
                continue
            with engine.begin() as conexion:
                actuales = _indices_de(conexion, definicion.name)
                for columna in columnas:
                    if columna == "establecimiento_id":
                        continue
                    global_ = f"ix_{definicion.name}_{columna}"
                    if actuales.get(global_):
                        logger.info("Migración: %s.%s pasa a ser único por establecimiento", definicion.name, columna)
                        conexion.execute(text(f"DROP INDEX {global_}"))
                        conexion.execute(text(f"CREATE INDEX {global_} ON {definicion.name} ({columna})"))
                conexion.execute(
                    text(
                        f"CREATE UNIQUE INDEX IF NOT EXISTS {indice.name} "
                        f"ON {definicion.name} ({', '.join(columnas)})"
                    )
                )


def migrar_establecimientos() -> None:
    """Idempotente: corre al principio de las migraciones (antes de las que usan
    el ORM sobre tablas de sede) y otra vez al final (por si alguna migración
    vieja reconstruyó una tabla y perdió la columna)."""
    existentes = tablas()
    if "establecimientos" not in existentes:
        return

    with engine.begin() as conexion:
        conexion.execute(
            text(
                "INSERT OR IGNORE INTO establecimientos (id, nombre, activo, fecha_creacion) "
                "VALUES (:id, :nombre, 1, CURRENT_TIMESTAMP)"
            ),
            {"id": ESTABLECIMIENTO_PRINCIPAL_ID, "nombre": NOMBRE_ESTABLECIMIENTO_PRINCIPAL},
        )

    if "personal" in existentes:
        agregar_columna("personal", "es_gerente", "BOOLEAN NOT NULL DEFAULT 0")

    for tabla, opcional in tablas_de_sede().items():
        if tabla not in existentes or tabla in CONFIGURACIONES_POR_SEDE:
            continue
        definicion = "INTEGER" if opcional else f"INTEGER NOT NULL DEFAULT {ESTABLECIMIENTO_PRINCIPAL_ID}"
        agregar_columna(tabla, "establecimiento_id", definicion)
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    f"CREATE INDEX IF NOT EXISTS ix_{tabla}_establecimiento_id "
                    f"ON {tabla} (establecimiento_id)"
                )
            )

    for tabla in CONFIGURACIONES_POR_SEDE:
        if tabla in existentes:
            _reconstruir_con_sede(tabla)

    for tabla, columna in UNICOS_EN_LA_TABLA:
        if tabla in existentes:
            _reconstruir_sin_unico_global(tabla, columna)

    _unicos_por_sede(existentes)

    if migracion_ya_corrio(CLAVE):
        return

    # Las columnas opcionales nacen en NULL: el personal previo pasa a la sede
    # principal (menos el super admin, que es de la empresa) y la bitácora
    # previa de entidades de sede, también.
    entidades_de_sede = [t for t, opcional in tablas_de_sede().items() if not opcional]
    with engine.begin() as conexion:
        if "personal" in existentes:
            conexion.execute(
                text(
                    "UPDATE personal SET establecimiento_id = :sede "
                    "WHERE establecimiento_id IS NULL AND es_super_admin = 0"
                ),
                {"sede": ESTABLECIMIENTO_PRINCIPAL_ID},
            )
        if "audit_log" in existentes and entidades_de_sede:
            marcadores = ", ".join(f":e{i}" for i in range(len(entidades_de_sede)))
            parametros = {f"e{i}": nombre for i, nombre in enumerate(entidades_de_sede)}
            parametros["sede"] = ESTABLECIMIENTO_PRINCIPAL_ID
            conexion.execute(
                text(
                    "UPDATE audit_log SET establecimiento_id = :sede "
                    f"WHERE establecimiento_id IS NULL AND entidad IN ({marcadores}, 'personal')"
                ),
                parametros,
            )
    marcar_migracion(CLAVE)
    logger.info("Multiestablecimiento: datos previos asignados al establecimiento principal.")
