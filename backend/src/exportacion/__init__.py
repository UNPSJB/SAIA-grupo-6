"""Módulo de exportación genérica de tablas a CSV/PDF.

Cada tabla del dominio puede exportarse igual que la bitácora de auditoría:
CSV con BOM y separador ";" (amigable con Excel en español) y PDF con
reportlab. El motor es compartido; lo que varía por tabla se declara en el
registro (`configuracion.REGISTRO_TABLAS`).

Flujo de uso:
    from src.exportacion.configuracion import REGISTRO_TABLAS
    from src.exportacion.motor import exportar_csv, exportar_pdf

    config = REGISTRO_TABLAS["personal"]
    csv_chunks = exportar_csv(db, config)
    pdf_bytes = exportar_pdf(db, config)
"""

__all__ = ["configuracion", "formato", "motor", "router"]
