"""Migración de lotes: los productos elaborados viven en el maestro de insumos."""

import logging

from sqlalchemy import text

from src.database import engine

from .base import agregar_columna, tablas

logger = logging.getLogger(__name__)


def migrar_lotes() -> None:
    existentes = tablas()

    # E1 es el maestro de insumos y también de los productos elaborados. Los
    # productos históricos se migran a `insumos` con tipo='producto' y los
    # lotes quedan vinculados a ese registro por id.
    if "insumos" in existentes:
        agregar_columna("insumos", "tipo", "VARCHAR(20) NOT NULL DEFAULT 'insumo'")
        with engine.begin() as conexion:
            conexion.execute(
                text("CREATE INDEX IF NOT EXISTS ix_insumos_tipo ON insumos (tipo)")
            )

    if "insumos" not in existentes or "lotes" not in existentes:
        return

    agregar_columna("lotes", "producto_id", "INTEGER REFERENCES insumos(id)")
    with engine.begin() as conexion:
        conexion.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_lotes_producto_id "
                "ON lotes (producto_id)"
            )
        )

    if "unidades_medida" not in existentes:
        return

    with engine.begin() as conexion:
        conexion.execute(
            text(
                "INSERT OR IGNORE INTO unidades_medida "
                "(nombre, simbolo, activo) VALUES ('unidad', 'u', 1)"
            )
        )
        unidad_id = conexion.execute(
            text(
                "SELECT id FROM unidades_medida "
                "WHERE simbolo = 'u' OR nombre = 'unidad' "
                "ORDER BY id LIMIT 1"
            )
        ).scalar_one_or_none()

    if unidad_id is None:
        return

    with engine.begin() as conexion:
        creados = 0
        if "productos" in existentes:
            creados += conexion.execute(
                text(
                    "INSERT OR IGNORE INTO insumos "
                    "(nombre, unidad_medida_id, activo, tipo) "
                    "SELECT DISTINCT TRIM(nombre), :unidad_id, "
                    "COALESCE(activo, 1), 'producto' FROM productos "
                    "WHERE nombre IS NOT NULL "
                    "AND TRIM(nombre) <> ''"
                ),
                {"unidad_id": unidad_id},
            ).rowcount
        creados += conexion.execute(
            text(
                "INSERT OR IGNORE INTO insumos "
                "(nombre, unidad_medida_id, activo, tipo) "
                "SELECT DISTINCT TRIM(producto_nombre), :unidad_id, "
                "1, 'producto' FROM lotes "
                "WHERE producto_nombre IS NOT NULL "
                "AND TRIM(producto_nombre) <> ''"
            ),
            {"unidad_id": unidad_id},
        ).rowcount
        actualizados = conexion.execute(
            text(
                "UPDATE lotes SET producto_id = ("
                "SELECT i.id FROM insumos i "
                "WHERE i.tipo = 'producto' "
                "AND lower(i.nombre) = lower(TRIM(lotes.producto_nombre)) "
                "ORDER BY i.id LIMIT 1"
                ") WHERE producto_id IS NULL "
                "AND producto_nombre IS NOT NULL "
                "AND TRIM(producto_nombre) <> ''"
            )
        ).rowcount

    if creados:
        logger.info(
            "Migración: se cargaron %s productos en el maestro de insumos.",
            creados,
        )
    if actualizados:
        logger.info(
            "Migración: se vincularon %s lotes con su producto de E1.",
            actualizados,
        )