"""Alérgenos: carga inicial del catálogo y columnas agregadas después.

Las tablas `alergenos` e `ingredientes_alergenos` las crea `create_all`.
Esta migración agrega en bases ya creadas lo que se sumó al unificarlas con
las declaraciones del rótulo (HU106): el código y la marca de "condicionada"
del catálogo, la forma (directa o derivado) de cada alérgeno del ingrediente
y la evaluación de alérgenos del ingrediente. Después carga la lista inicial
si el catálogo está vacío. Es idempotente.
"""

import re

from sqlalchemy import text

from src.common.texto import normalizar_texto
from src.database import SessionLocal, engine

from .base import agregar_columna, tablas


def _completar_codigos() -> None:
    """Las filas cargadas antes de existir `codigo` lo toman de su nombre."""
    with engine.begin() as conexion:
        filas = conexion.execute(
            text("SELECT id, nombre FROM alergenos WHERE codigo IS NULL OR codigo = ''")
        ).all()
        usados = {
            fila[0]
            for fila in conexion.execute(
                text("SELECT codigo FROM alergenos WHERE codigo IS NOT NULL AND codigo != ''")
            )
        }
        for alergeno_id, nombre in filas:
            base = re.sub(r"[^a-z0-9]+", "_", normalizar_texto(nombre)).strip("_")[:36] or "alergeno"
            codigo, n = base, 2
            while codigo in usados:
                codigo, n = f"{base}_{n}", n + 1
            usados.add(codigo)
            conexion.execute(
                text("UPDATE alergenos SET codigo = :codigo WHERE id = :id"),
                {"codigo": codigo, "id": alergeno_id},
            )


def migrar_alergenos() -> None:
    existentes = tablas()
    if "ingredientes" in existentes:
        agregar_columna(
            "ingredientes", "evaluacion_alergenos", "VARCHAR(20) NOT NULL DEFAULT 'sin_evaluar'"
        )
        agregar_columna("ingredientes", "gluten", "VARCHAR(20) NOT NULL DEFAULT 'desconocido'")
        agregar_columna("ingredientes", "respaldo_alergenos", "TEXT")
        agregar_columna("ingredientes", "observaciones_alergenos", "TEXT")
        agregar_columna("ingredientes", "alergenos_actualizado_en", "DATETIME")
        agregar_columna(
            "ingredientes", "alergenos_actualizado_por_id", "INTEGER REFERENCES personal(id)"
        )
    if "ingredientes_alergenos" in existentes:
        agregar_columna(
            "ingredientes_alergenos", "forma", "VARCHAR(10) NOT NULL DEFAULT 'directa'"
        )
    if "alergenos" not in existentes:
        return
    agregar_columna("alergenos", "codigo", "VARCHAR(40)")
    agregar_columna("alergenos", "condicionada", "BOOLEAN NOT NULL DEFAULT 0")
    _completar_codigos()
    from src.alergenos.services import cargar_alergenos_iniciales

    db = SessionLocal()
    try:
        cargar_alergenos_iniciales(db)
    finally:
        db.close()
