"""Migración de retiros de lote del mercado (Historia 21).

Crea las tablas `retiros` y `retiros_afectados` si todavía no existen.
Idempotente: si ya corrió, no hace nada.
"""

import logging

from sqlalchemy import text

from src.database import engine
from src.models import ModeloBase
from src.retiros.models import Retiro, RetiroAfectado
from .base import (
    crear_bitacora,
    marcar_migracion,
    migracion_ya_corrio,
    tablas,
)

logger = logging.getLogger(__name__)

CLAVE = "retiros"


def _crear_tablas_si_faltan() -> None:
    """Crea `retiros` y `retiros_afectados` si faltan.

    Usa `ModeloBase.metadata.create_all` con `checkfirst=True` (default), así que
    es idempotente: solo crea las tablas que aún no existen y resuelve todas las
    FKs desde el registro completo de modelos.
    """
    tablas_faltantes = [
        t.__tablename__
        for t in (Retiro, RetiroAfectado)
        if t.__tablename__ not in tablas()
    ]
    if not tablas_faltantes:
        return
    logger.info("Migración: creando tablas %s", tablas_faltantes)
    with engine.begin() as conexion:
        # create_all sin `tables=` crea todas las tablas del registro que faltan,
        # resolviendo FKs correctamente. checkfirst=True evita errores si ya existen.
        ModeloBase.metadata.create_all(conexion)


def migrar_retiros() -> None:
    crear_bitacora()
    if migracion_ya_corrio(CLAVE):
        return

    _crear_tablas_si_faltan()
    marcar_migracion(CLAVE)
