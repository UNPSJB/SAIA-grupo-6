"""Migración de reposiciones (deuda comercial de stock con clientes).

1. Crea la tabla `reposiciones` si todavía no existe.
2. Ajusta `cantidad_original` / `cantidad_pendiente` a Numeric(14, 3) (mismo tipo
   que `Salida.cantidad`) en las bases donde la tabla se creó con INTEGER.

Ambas pasos son idempotentes.
"""

import logging

from sqlalchemy import inspect, text

from src.database import engine
from src.models import ModeloBase
from src.reposiciones.models import Reposicion
from .base import (
    agregar_columna,
    columnas_de,
    crear_bitacora,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "reposiciones"
CLAVE_CANTIDAD_NUMERIC = "reposiciones_cantidad_numeric"
CLAVE_INCIDENTE_BACKFILL = "reposiciones_incidente_origen_backfill"


def _crear_tabla_si_falta() -> None:
    if Reposicion.__tablename__ in tablas():
        return
    logger.info("Migración: creando tabla %s", Reposicion.__tablename__)
    with engine.begin() as conexion:
        ModeloBase.metadata.create_all(conexion)


def _cantidades_a_numeric() -> None:
    """Reconstruye la tabla si las cantidades quedaron como INTEGER (SQLite)."""
    tabla = Reposicion.__tablename__
    columnas = {c["name"]: c for c in inspect(engine).get_columns(tabla)}
    tipo = str(columnas["cantidad_original"]["type"]).upper()
    if "INT" not in tipo:
        return

    logger.info("Migración: %s.cantidad_* INTEGER -> NUMERIC(14, 3)", tabla)
    with engine.begin() as conexion:
        filas = [dict(f._mapping) for f in conexion.execute(Reposicion.__table__.select())]
        Reposicion.__table__.drop(conexion)
        Reposicion.__table__.create(conexion)
        if filas:
            conexion.execute(Reposicion.__table__.insert(), filas)


def _vincular_reclamos_sin_incidente() -> None:
    """Completa `incidente_origen_id` en reposiciones por reclamo antiguas.

    Las reposiciones `POR_RECLAMO` creadas antes de existir la columna quedaron
    con `incidente_origen_id` en NULL y por eso la tabla no podía mostrar el
    link al reclamo. Se vinculan con el último incidente cerrado de su salida
    de origen. Es idempotente: solo toca filas que siguen en NULL.
    """
    tabla = Reposicion.__tablename__
    if "incidente_origen_id" not in columnas_de(tabla):
        return
    with engine.begin() as conexion:
        resultado = conexion.execute(
            text(
                f"UPDATE {tabla} "
                "SET incidente_origen_id = ("
                "  SELECT i.id FROM incidentes i "
                f"  WHERE i.salida_id = {tabla}.salida_origen_id "
                "    AND i.estado = 'cerrado' "
                "  ORDER BY i.id DESC LIMIT 1"
                ") "
                "WHERE origen = 'POR_RECLAMO' "
                "  AND incidente_origen_id IS NULL "
                "  AND salida_origen_id IS NOT NULL"
            )
        )
    if resultado.rowcount:
        logger.info(
            "Migración: %s reposición(es) por reclamo vinculadas a su incidente",
            resultado.rowcount,
        )


def migrar_reposiciones() -> None:
    crear_bitacora()
    if not migracion_ya_corrio(CLAVE):
        _crear_tabla_si_falta()
        marcar_migracion(CLAVE)

    if not migracion_ya_corrio(CLAVE_CANTIDAD_NUMERIC):
        _cantidades_a_numeric()
        marcar_migracion(CLAVE_CANTIDAD_NUMERIC)

    agregar_columna(
        Reposicion.__tablename__,
        "incidente_origen_id",
        "INTEGER REFERENCES incidentes(id)",
    )

    if not migracion_ya_corrio(CLAVE_INCIDENTE_BACKFILL):
        _vincular_reclamos_sin_incidente()
        marcar_migracion(CLAVE_INCIDENTE_BACKFILL)
