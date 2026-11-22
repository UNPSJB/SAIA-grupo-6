"""Alérgenos: carga inicial del catálogo y columna en los borradores de rotulado.

Las tablas `alergenos` e `ingredientes_alergenos` las crea `create_all`.
Esta migración carga la lista inicial si el catálogo está vacío y agrega
`borradores_rotulado.alergenos` en bases ya creadas. Es idempotente.
"""

from src.database import SessionLocal

from .base import agregar_columna, tablas


def migrar_alergenos() -> None:
    existentes = tablas()
    if "borradores_rotulado" in existentes:
        agregar_columna("borradores_rotulado", "alergenos", "TEXT")
    if "alergenos" not in existentes:
        return
    from src.alergenos.services import cargar_alergenos_iniciales

    db = SessionLocal()
    try:
        cargar_alergenos_iniciales(db)
    finally:
        db.close()
