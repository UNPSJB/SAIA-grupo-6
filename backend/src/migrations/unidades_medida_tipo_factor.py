"""Migración: agrega columnas tipo y factor_a_base a unidades_medida.

tipo: enum de texto (masa, volumen, unidad), default 'unidad'.
factor_a_base: NUMERIC(10,4) > 0, default 1.0.
"""

import logging

from sqlalchemy import text

from src.database import engine
from src.migrations.base import agregar_columna, marcar_migracion, migracion_ya_corrio, crear_bitacora
from src.unidadMedida.constants import equivalencia_conocida

logger = logging.getLogger(__name__)


def migrar_unidades_medida_tipo_factor() -> None:
    crear_bitacora()
    if migracion_ya_corrio("unidades_medida_tipo_factor"):
        return
    agregar_columna(
        "unidades_medida",
        "tipo",
        "VARCHAR(10) NOT NULL DEFAULT 'unidad'",
    )
    agregar_columna(
        "unidades_medida",
        "factor_a_base",
        "NUMERIC(10,4) NOT NULL DEFAULT 1.0",
    )
    marcar_migracion("unidades_medida_tipo_factor")


def asignar_equivalencias_conocidas() -> None:
    """Completa tipo y factor de las unidades comunes (una sola vez).

    La migración de arriba dejó todas las unidades existentes como tipo
    "unidad" con factor 1, así que un kilogramo pedía peso unitario y la
    composición porcentual no podía calcularse. Acá se corrigen las que se
    reconocen por nombre o símbolo (`equivalencia_conocida`). Solo se tocan las que
    siguen con el default: si alguien ya cargó tipo o factor a mano, se respeta.
    """
    crear_bitacora()
    clave = "unidades_medida_equivalencias_conocidas"
    if migracion_ya_corrio(clave):
        return
    with engine.begin() as conexion:
        filas = conexion.execute(
            text(
                "SELECT id, nombre, simbolo FROM unidades_medida "
                "WHERE tipo = 'unidad' AND factor_a_base = 1"
            )
        ).all()
        for id_unidad, nombre, simbolo in filas:
            equivalencia = equivalencia_conocida(nombre, simbolo)
            if equivalencia is None:
                continue
            logger.info("Migración: unidad %s -> %s", nombre, equivalencia)
            conexion.execute(
                text(
                    "UPDATE unidades_medida SET tipo = :tipo, "
                    "factor_a_base = :factor_a_base WHERE id = :id"
                ),
                {**equivalencia, "id": id_unidad},
            )
    marcar_migracion(clave)
