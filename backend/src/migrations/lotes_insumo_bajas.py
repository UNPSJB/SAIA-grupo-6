from .base import agregar_columna, tablas


def migrar_lotes_insumo_bajas() -> None:
    # La tabla bajas_lote_insumo se crea automáticamente mediante metadata.create_all().
    if "lotes_insumo" in tablas():
        agregar_columna("lotes_insumo", "dado_de_baja_por_id", "INTEGER REFERENCES personal(id)")