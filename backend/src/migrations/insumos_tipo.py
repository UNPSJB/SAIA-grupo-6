"""E9: el tipo del insumo pasa de insumo/producto a ingrediente/aditivo.

Los productos tienen su propia tabla desde la trazabilidad (`trazabilidad.py`
ya copió los `insumos.tipo='producto'` a `productos`), así que el tipo se
reutiliza para lo que pide la receta: si el insumo es ingrediente o aditivo.
Un aditivo apunta a la lista de referencia (clase funcional, nombre completo
e INS).

SQLite no permite cambiar un CHECK, así que `insumos` se reconstruye:

* `insumo` -> `ingrediente`;
* `producto` -> se borra si nada lo referencia; si lo referencia una tabla
  vieja (p. ej. `lotes`), queda como ingrediente dado de baja;
* un insumo que alguna receta usa como aditivo y cuyo nombre coincide con un
  aditivo de la referencia queda como aditivo con esa referencia. El resto
  queda como ingrediente y se reclasifica desde la app.

Se conservan los ids, así que las FK de las demás tablas siguen valiendo.
Es idempotente: si la tabla ya tiene el esquema nuevo, no hace nada.
"""

import logging

from sqlalchemy import text
from sqlalchemy.schema import CreateIndex, CreateTable

from src.aditivos.referencia import ADITIVOS, CLASES
from src.database import engine
from src.insumos.models import Insumo

from .base import agregar_columna, columnas_de, tablas

logger = logging.getLogger(__name__)

_TABLA_TEMPORAL = "insumos_migracion_tipo"


def migrar_aditivos_referencia() -> None:
    """Carga inicial de clases funcionales y aditivos, solo si están vacías."""
    existentes = tablas()
    if not {"clases_funcionales", "aditivos"} <= existentes:
        return
    with engine.begin() as conexion:
        if not conexion.execute(text("SELECT COUNT(*) FROM clases_funcionales")).scalar_one():
            logger.info("Migración: cargando las clases funcionales de aditivos.")
            for nombre, ins_opcional in CLASES:
                conexion.execute(
                    text(
                        "INSERT INTO clases_funcionales (nombre, ins_opcional, activo) "
                        "VALUES (:nombre, :ins_opcional, 1)"
                    ),
                    {"nombre": nombre, "ins_opcional": ins_opcional},
                )
        if not conexion.execute(text("SELECT COUNT(*) FROM aditivos")).scalar_one():
            logger.info("Migración: cargando la lista de referencia de aditivos.")
            for clase, nombre, ins in ADITIVOS:
                conexion.execute(
                    text(
                        "INSERT INTO aditivos (clase_funcional_id, nombre, numero_ins, activo) "
                        "SELECT id, :nombre, :ins, 1 FROM clases_funcionales "
                        "WHERE nombre = :clase"
                    ),
                    {"clase": clase, "nombre": nombre, "ins": ins},
                )


def migrar_porcion_receta() -> None:
    """Porción o unidad de venta en `versiones_receta` (bases ya creadas)."""
    if "versiones_receta" not in tablas():
        return
    agregar_columna("versiones_receta", "porcion_descripcion", "VARCHAR(100)")
    agregar_columna(
        "versiones_receta",
        "porcion_cantidad",
        "NUMERIC(14, 3) CHECK (porcion_cantidad IS NULL OR porcion_cantidad > 0)",
    )
    agregar_columna(
        "versiones_receta",
        "porcion_unidad_medida_id",
        "INTEGER REFERENCES unidades_medida(id)",
    )


def _necesita_reconstruir(conexion, columnas: set[str]) -> bool:
    sql = conexion.execute(
        text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'insumos'")
    ).scalar_one_or_none() or ""
    return "aditivo_id" not in columnas or "'producto'" in sql or "'ingrediente'" not in sql


def _referencias_a_insumos(conexion, existentes: set[str]) -> list[tuple[str, str]]:
    """(tabla, columna) de todas las FK que apuntan a `insumos`."""
    referencias = []
    for tabla in existentes:
        if tabla == "insumos":
            continue
        for fila in conexion.execute(text(f'PRAGMA foreign_key_list("{tabla}")')).mappings():
            if fila["table"] == "insumos":
                referencias.append((tabla, fila["from"]))
    return referencias


def migrar_insumos_tipo() -> None:
    # El esquema se lee ANTES de abrir la transacción: `inspect(engine)` usa
    # otra conexión (o la misma, con StaticPool) y no debe cruzarse con ella.
    existentes = tablas()
    if "insumos" not in existentes:
        return
    columnas = columnas_de("insumos")

    with engine.connect() as conexion:
        if not _necesita_reconstruir(conexion, columnas):
            conexion.rollback()
            return
        conexion.rollback()

        # Reemplazar la tabla padre exige apagar las FK un momento (los ids no cambian).
        fk_habilitadas = conexion.execute(text("PRAGMA foreign_keys")).scalar_one()
        conexion.commit()
        if fk_habilitadas:
            conexion.execute(text("PRAGMA foreign_keys = OFF"))
            conexion.commit()

        try:
            with conexion.begin():
                logger.info("Migración: reconstruyendo insumos con tipo ingrediente/aditivo.")
                tiene_tipo = "tipo" in columnas
                tiene_aditivo = "aditivo_id" in columnas

                # 1) Productos viejos: se borran si nadie los referencia.
                if tiene_tipo:
                    referencias = _referencias_a_insumos(conexion, existentes)
                    productos = conexion.execute(
                        text("SELECT id FROM insumos WHERE tipo = 'producto'")
                    ).scalars().all()
                    for insumo_id in productos:
                        usado = any(
                            conexion.execute(
                                text(f'SELECT 1 FROM "{tabla}" WHERE "{columna}" = :id LIMIT 1'),
                                {"id": insumo_id},
                            ).first()
                            for tabla, columna in referencias
                        )
                        if usado:
                            conexion.execute(
                                text("UPDATE insumos SET activo = 0 WHERE id = :id"), {"id": insumo_id}
                            )
                        else:
                            conexion.execute(text("DELETE FROM insumos WHERE id = :id"), {"id": insumo_id})

                total_antes = conexion.execute(text("SELECT COUNT(*) FROM insumos")).scalar_one()

                # 2) Tabla nueva con el esquema del modelo (CHECKs incluidos).
                crear = str(CreateTable(Insumo.__table__).compile(engine)).replace(
                    "CREATE TABLE insumos (", f"CREATE TABLE {_TABLA_TEMPORAL} (", 1
                )
                conexion.execute(text(crear))

                if tiene_aditivo:
                    expresion_aditivo = "CASE WHEN tipo = 'aditivo' THEN aditivo_id END"
                    expresion_tipo = (
                        "CASE WHEN tipo = 'aditivo' AND aditivo_id IS NOT NULL "
                        "THEN 'aditivo' ELSE 'ingrediente' END"
                    )
                else:
                    expresion_aditivo = "NULL"
                    expresion_tipo = "'ingrediente'"
                conexion.execute(
                    text(
                        f"INSERT INTO {_TABLA_TEMPORAL} "
                        "(id, nombre, unidad_medida_id, activo, tipo, aditivo_id) "
                        f"SELECT id, nombre, unidad_medida_id, activo, {expresion_tipo}, "
                        f"{expresion_aditivo} FROM insumos"
                    )
                )

                # 3) Insumos que una receta usa como aditivo: se vinculan a la
                #    referencia si el nombre coincide.
                if {"receta_insumo", "aditivos"} <= existentes:
                    conexion.execute(
                        text(
                            f"UPDATE {_TABLA_TEMPORAL} SET tipo = 'aditivo', aditivo_id = ("
                            "  SELECT a.id FROM aditivos a "
                            f"  WHERE lower(trim(a.nombre)) = lower(trim({_TABLA_TEMPORAL}.nombre)) "
                            "  ORDER BY a.id LIMIT 1) "
                            f"WHERE tipo = 'ingrediente' "
                            f"AND id IN (SELECT insumo_id FROM receta_insumo WHERE clasificacion = 'aditivo') "
                            "AND EXISTS (SELECT 1 FROM aditivos a "
                            f"  WHERE lower(trim(a.nombre)) = lower(trim({_TABLA_TEMPORAL}.nombre)))"
                        )
                    )

                total_despues = conexion.execute(
                    text(f"SELECT COUNT(*) FROM {_TABLA_TEMPORAL}")
                ).scalar_one()
                if total_despues != total_antes:
                    raise RuntimeError(
                        "La migración de insumos no conservó la cantidad de registros "
                        f"({total_antes} antes, {total_despues} después)."
                    )

                # 4) Reemplazo e índices.
                conexion.execute(text("DROP TABLE insumos"))
                conexion.execute(text(f"ALTER TABLE {_TABLA_TEMPORAL} RENAME TO insumos"))
                for indice in Insumo.__table__.indexes:
                    conexion.execute(text(str(CreateIndex(indice).compile(engine))))

                # Solo se borraron productos sin referencias, así que esto no
                # debería encontrar nada nuevo; si las tablas viejas ya traían
                # referencias rotas, se avisa pero no se frena la migración.
                rotas = conexion.execute(text("PRAGMA foreign_key_check")).fetchall()
                rotas = [fila for fila in rotas if fila[2] == "insumos" or fila[0] == "insumos"]
                if rotas:
                    logger.warning("Migración de insumos: referencias rotas previas: %s", rotas[:5])
        finally:
            if fk_habilitadas:
                conexion.execute(text("PRAGMA foreign_keys = ON"))
                conexion.commit()
