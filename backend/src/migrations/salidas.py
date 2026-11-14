"""Migración de salidas de producto (despacho, entrega, cancelación).

Agrega columnas a `salidas` (forma_entrega, transportista_id, fecha_despacho,
fecha_entrega, observacion_entrega, motivo_cancelacion, cancelada_por_id,
fecha_cancelacion) y crea la tabla `salida_certificaciones` si todavía no
existen. Idempotente.
"""

import logging

from sqlalchemy import text

from src.database import engine
from src.salidas.models import SalidaCertificacion, Salida
from .base import (
    agregar_columna,
    crear_bitacora,
    columnas_de,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "salidas_despacho_entrega_cancelacion"


def _tablas_existen() -> bool:
    return {"salidas", "salida_certificaciones"}.issubset(tablas())


def _crear_tabla_salida_certificaciones_si_falta() -> None:
    """Crea `salida_certificaciones` con el esquema del modelo si falta."""
    from src.models import ModeloBase
    from sqlalchemy import MetaData

    if "salida_certificaciones" in tablas():
        return

    meta = MetaData()
    tabla = SalidaCertificacion.__table__.to_metadata(meta)

    logger.info("Migración: creando tabla salida_certificaciones")
    with engine.begin() as conexion:
        meta.create_all(conexion, tables=[tabla])


def migrar_salidas_despacho_entrega_cancelacion() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    if "salidas" in tablas():
        columnas_actuales = columnas_de("salidas")
        definiciones = {
            "forma_entrega": "VARCHAR(30)",
            "transportista_id": "INTEGER",
            "fecha_despacho": "DATE",
            "fecha_entrega": "DATE",
            "observacion_entrega": "VARCHAR(500)",
            "motivo_cancelacion": "VARCHAR(500)",
            "cancelada_por_id": "INTEGER",
            "fecha_cancelacion": "DATETIME",
        }
        for columna, definicion in definiciones.items():
            if columna not in columnas_actuales:
                agregar_columna("salidas", columna, definicion)

    _crear_tabla_salida_certificaciones_si_falta()
    marcar_migracion(CLAVE)
