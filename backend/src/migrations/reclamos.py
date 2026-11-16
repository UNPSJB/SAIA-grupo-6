"""Migración de los reclamos de clientes (Historia 20, SQLite, idempotente).

- Agrega el parámetro `plazo_reclamo_dias` a `configuracion_alertas` (tabla
  clave-valor): si falta, se inserta con 30. Las configuraciones existentes
  conservan sus otros valores.
- Crea la tabla `reclamos` si no existe. Normalmente ya la creó
  `create_all` a partir del modelo; el DDL se repite acá para que la
  migración funcione también sobre una base vieja que se migre sin volver a
  correr `create_all`.
- El tipo de incidente "Reclamo de cliente" y el evento de hito `RECLAMO` NO
  necesitan migración: los tipos de incidente son una lista fija en Python
  (`TipoIncidente`) y `historial_lotes.tipo_evento` no tiene CHECK en SQLite,
  igual que pasó con "Entrega rechazada" y `RECHAZO`.

Sin backfill: no hay reclamos históricos que reconstruir.
"""

import logging

from sqlalchemy import text

from src.database import engine

from .base import marcar_migracion, migracion_ya_corrio, tablas

logger = logging.getLogger(__name__)

CLAVE = "reclamos_cliente_v1"

_PLAZO_POR_DEFECTO = 30

_DDL_RECLAMOS = """
CREATE TABLE IF NOT EXISTS reclamos (
    id INTEGER NOT NULL,
    salida_id INTEGER NOT NULL,
    lote_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    incidente_id INTEGER,
    fecha_reclamo DATE NOT NULL,
    motivo VARCHAR(50) NOT NULL,
    detalle VARCHAR(500),
    fecha_entrega_ref DATE NOT NULL,
    dias_desde_entrega INTEGER NOT NULL,
    plazo_referencia_dias INTEGER NOT NULL,
    fuera_de_plazo BOOLEAN NOT NULL,
    registrado_por_id INTEGER NOT NULL,
    fecha_registro DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(salida_id) REFERENCES salidas (id) ON DELETE RESTRICT,
    FOREIGN KEY(lote_id) REFERENCES lotes_producto (id) ON DELETE RESTRICT,
    FOREIGN KEY(cliente_id) REFERENCES clientes (id) ON DELETE RESTRICT,
    FOREIGN KEY(registrado_por_id) REFERENCES personal (id) ON DELETE RESTRICT
)
"""

_INDICES_RECLAMOS = (
    ("ix_reclamos_id", "id"),
    ("ix_reclamos_salida_id", "salida_id"),
    ("ix_reclamos_lote_id", "lote_id"),
    ("ix_reclamos_cliente_id", "cliente_id"),
    ("ix_reclamos_incidente_id", "incidente_id"),
    ("ix_reclamos_fecha_reclamo", "fecha_reclamo"),
)


def migrar_reclamos() -> None:
    if migracion_ya_corrio(CLAVE):
        return

    existentes = tablas()

    with engine.begin() as conexion:
        if "configuracion_alertas" in existentes:
            conexion.execute(
                text(
                    "INSERT OR IGNORE INTO configuracion_alertas (clave, valor) "
                    "VALUES ('plazo_reclamo_dias', :valor)"
                ),
                {"valor": _PLAZO_POR_DEFECTO},
            )

        if "salidas" in existentes:
            conexion.execute(text(_DDL_RECLAMOS))
            for nombre, columna in _INDICES_RECLAMOS:
                conexion.execute(
                    text(
                        f'CREATE INDEX IF NOT EXISTS "{nombre}" '
                        f'ON reclamos ("{columna}")'
                    )
                )

    marcar_migracion(CLAVE)
