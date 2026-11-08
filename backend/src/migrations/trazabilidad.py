"""Migración a trazabilidad: `lotes` evoluciona a `lotes_producto`.

SQLite no permite cambiar un CHECK (los estados cambian de nombre) ni renombrar
columnas con sus índices de forma segura, así que los lotes históricos se copian
a la tabla nueva que ya creó `create_all`:

* los productos (`insumos.tipo='producto'` y los nombres de lote) pasan a `productos`;
* `lotes` -> `lotes_producto`, conservando el `id`; estados renombrados;
* los lotes históricos quedan sin versión de receta (no la tenían).

Las tablas viejas (`lotes`, `lotes_insumos`) no se borran: `lotes_insumos` no
tiene equivalente (no registraba lote de insumo ni proveedor). Corre una sola vez.
"""

import logging

from sqlalchemy import text

from src.database import engine

from .base import marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "trazabilidad_lotes_producto_v1"

_NOMBRE_PRODUCTO = "COALESCE(NULLIF(TRIM({col}), ''), 'Producto sin nombre')"


def migrar_trazabilidad() -> None:
    if migracion_ya_corrio(CLAVE):
        return
    existentes = tablas()
    if "lotes" not in existentes or not {"productos", "lotes_producto"} <= existentes:
        marcar_migracion(CLAVE)
        return

    nombre_lote = _NOMBRE_PRODUCTO.format(col="l.producto_nombre")
    with engine.begin() as conexion:
        unidad_id = None
        if "unidades_medida" in existentes:
            conexion.execute(
                text(
                    "INSERT OR IGNORE INTO unidades_medida (nombre, simbolo, activo) "
                    "VALUES ('unidad', 'u', 1)"
                )
            )
            unidad_id = conexion.execute(
                text(
                    "SELECT id FROM unidades_medida "
                    "WHERE simbolo = 'u' OR nombre = 'unidad' ORDER BY id LIMIT 1"
                )
            ).scalar_one_or_none()

        if "insumos" in existentes:
            conexion.execute(
                text(
                    "INSERT OR IGNORE INTO productos (nombre, unidad_medida_id, activo) "
                    "SELECT TRIM(nombre), unidad_medida_id, COALESCE(activo, 1) "
                    "FROM insumos WHERE tipo = 'producto' "
                    "AND nombre IS NOT NULL AND TRIM(nombre) <> ''"
                )
            )
        if unidad_id is not None:
            conexion.execute(
                text(
                    f"INSERT OR IGNORE INTO productos (nombre, unidad_medida_id, activo) "
                    f"SELECT DISTINCT {nombre_lote}, :unidad_id, 1 FROM lotes l "
                    f"WHERE NOT EXISTS (SELECT 1 FROM productos p "
                    f"WHERE lower(p.nombre) = lower({nombre_lote}))"
                ),
                {"unidad_id": unidad_id},
            )

        copiados = conexion.execute(
            text(
                "INSERT INTO lotes_producto "
                "(id, numero_lote, producto_id, version_receta_id, estado, "
                "cantidad_objetivo, cantidad_producida, fecha_inicio, fecha_cierre) "
                "SELECT l.id, l.codigo_lote, "
                f"(SELECT p.id FROM productos p WHERE lower(p.nombre) = lower({nombre_lote}) "
                "ORDER BY p.id LIMIT 1), "
                "NULL, "
                "CASE l.estado WHEN 'Finalizado' THEN 'terminado' "
                "WHEN 'Cancelado' THEN 'cancelado' ELSE 'en_proceso' END, "
                "l.cantidad_planificada, "
                "CASE l.estado WHEN 'Finalizado' THEN l.cantidad_producida ELSE NULL END, "
                "COALESCE(l.fecha_inicio, CURRENT_TIMESTAMP), "
                "CASE WHEN l.estado IN ('Finalizado', 'Cancelado') "
                "THEN l.fecha_inicio ELSE NULL END "
                "FROM lotes l "
                "WHERE NOT EXISTS (SELECT 1 FROM lotes_producto lp WHERE lp.id = l.id)"
            )
        ).rowcount

    marcar_migracion(CLAVE)
    if copiados:
        logger.info("Migración: %s lotes históricos copiados a lotes_producto.", copiados)
