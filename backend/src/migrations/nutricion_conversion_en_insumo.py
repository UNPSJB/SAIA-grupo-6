"""Migración: la densidad y el peso por unidad pasan del perfil nutricional al insumo.

Había dos copias del mismo dato: `perfiles_nutricionales_insumo.densidad_g_ml`
/ `peso_unidad_g` (tabla nutricional, E11) e `insumos.densidad_g_ml` /
`peso_unitario_g` (composición porcentual). Queda solo la del insumo.

1. Se copia al insumo lo que el perfil tenía y el insumo no. Si los dos tienen
   un valor distinto gana el del insumo (es el que valida el alta del insumo)
   y se deja constancia en el log.
2. Se reconstruye `perfiles_nutricionales_insumo` sin esas dos columnas
   (SQLite no deja borrar una columna que nombra un CHECK).

Idempotente: si la tabla ya no tiene las columnas, no hace nada.
"""

import logging

from sqlalchemy import text

from src.database import engine

from .base import columnas_de, hay_insumos_viejo, tablas

logger = logging.getLogger(__name__)

TABLA = "perfiles_nutricionales_insumo"

# Esquema del perfil congelado tal como era al escribir esta migración. No se
# genera desde el modelo: la tabla después pasó a llamarse
# `perfiles_nutricionales_ingrediente`.
_COLUMNAS_PERFIL = (
    "insumo_id",
    "aporta_energia_sodio",
    "azucares_son_anadidos",
    "grasas_son_anadidas",
    "sodio_es_anadido",
    "contiene_edulcorantes",
    "contiene_cafeina",
)
_DDL_PERFIL = f"""CREATE TABLE {TABLA} (
	insumo_id INTEGER NOT NULL,
	aporta_energia_sodio BOOLEAN NOT NULL,
	azucares_son_anadidos BOOLEAN DEFAULT '0' NOT NULL,
	grasas_son_anadidas BOOLEAN DEFAULT '0' NOT NULL,
	sodio_es_anadido BOOLEAN DEFAULT '0' NOT NULL,
	contiene_edulcorantes BOOLEAN DEFAULT '0' NOT NULL,
	contiene_cafeina BOOLEAN DEFAULT '0' NOT NULL,
	PRIMARY KEY (insumo_id),
	FOREIGN KEY(insumo_id) REFERENCES insumos (id) ON DELETE CASCADE
)"""
# columna del perfil -> columna del insumo
COPIAS = {"densidad_g_ml": "densidad_g_ml", "peso_unidad_g": "peso_unitario_g"}


def migrar_conversion_a_insumo() -> None:
    if TABLA not in tablas() or not hay_insumos_viejo():
        return
    columnas = columnas_de(TABLA)
    viejas = [c for c in COPIAS if c in columnas]
    if not viejas:
        return
    columnas_insumo = columnas_de("insumos")
    conservadas = [c for c in _COLUMNAS_PERFIL if c in columnas]

    with engine.connect() as conexion:
        fk_habilitadas = conexion.execute(text("PRAGMA foreign_keys")).scalar_one()
        conexion.commit()
        if fk_habilitadas:
            conexion.execute(text("PRAGMA foreign_keys = OFF"))
            conexion.commit()
        try:
            with conexion.begin():
                for vieja in viejas:
                    destino = COPIAS[vieja]
                    if destino not in columnas_insumo:
                        continue
                    distintos = conexion.execute(
                        text(
                            f"SELECT i.nombre FROM insumos i JOIN {TABLA} p ON p.insumo_id = i.id "
                            f"WHERE i.{destino} IS NOT NULL AND p.{vieja} IS NOT NULL "
                            f"AND i.{destino} <> p.{vieja}"
                        )
                    ).scalars().all()
                    for nombre in distintos:
                        logger.warning(
                            "Migración: %s tenía %s distinto en insumo y perfil; queda el del insumo.",
                            nombre,
                            destino,
                        )
                    copiados = conexion.execute(
                        text(
                            f"UPDATE insumos SET {destino} = ("
                            f"SELECT p.{vieja} FROM {TABLA} p WHERE p.insumo_id = insumos.id) "
                            f"WHERE {destino} IS NULL AND EXISTS ("
                            f"SELECT 1 FROM {TABLA} p WHERE p.insumo_id = insumos.id "
                            f"AND p.{vieja} IS NOT NULL)"
                        )
                    ).rowcount
                    logger.info("Migración: %s copiado del perfil a %s insumos.", destino, copiados)

                logger.info("Migración: reconstruyendo %s sin densidad ni peso.", TABLA)
                conexion.execute(text(f"ALTER TABLE {TABLA} RENAME TO {TABLA}__vieja"))
                conexion.execute(text(_DDL_PERFIL))
                lista = ", ".join(conservadas)
                conexion.execute(
                    text(f"INSERT INTO {TABLA} ({lista}) SELECT {lista} FROM {TABLA}__vieja")
                )
                conexion.execute(text(f"DROP TABLE {TABLA}__vieja"))
        finally:
            if fk_habilitadas:
                conexion.execute(text("PRAGMA foreign_keys = ON"))
                conexion.commit()
