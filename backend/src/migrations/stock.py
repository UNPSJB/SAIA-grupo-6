import logging

from sqlalchemy import text

from src.database import engine

from .base import tablas

logger = logging.getLogger(__name__)


def migrar_stock() -> None:
    existentes = tablas()

    # Los productos que ya existían empiezan explícitamente con saldo cero.
    # No se reconstruye ni descuenta el histórico de checklist: esa información
    # no representa una carga inicial verificable.
    if "insumos_quimicos" in existentes and "stock_insumos_quimicos" in existentes:
        with engine.begin() as conexion:
            creados = conexion.execute(
                text(
                    "INSERT OR IGNORE INTO stock_insumos_quimicos "
                    "(insumo_quimico_id, cantidad_actual, actualizado_en) "
                    "SELECT id, 0, CURRENT_TIMESTAMP FROM insumos_quimicos"
                )
            ).rowcount
        if creados:
            logger.info(
                "Migración: se inicializaron %s saldos de productos químicos.", creados
            )

    # Las tablas nuevas se crean con metadata.create_all() antes de las
    # migraciones. Este índice se asegura de forma idempotente para bases ya
    # existentes.
    if "lotes_stock" in existentes:
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_lotes_stock_proveedor_insumo_lote "
                    "ON lotes_stock (proveedor_id, insumo_quimico_id, numero_lote)"
                )
            )
