"""Campos extendidos de proveedores y respaldo de certificación por recepción."""
from sqlalchemy import inspect, text
from src.database import engine

def migrar_proveedores():
    inspector = inspect(engine)
    existentes = {c["name"] for c in inspector.get_columns("proveedores")}
    columnas = {
        "cuit": "VARCHAR(13)",
        "contacto": "VARCHAR(150)",
        "domicilio": "VARCHAR(250)",
        "rubro": "VARCHAR(120)",
        "es_certificado": "BOOLEAN NOT NULL DEFAULT 0",
    }
    with engine.begin() as conn:
        for nombre, tipo in columnas.items():
            if nombre not in existentes:
                conn.execute(text(f"ALTER TABLE proveedores ADD COLUMN {nombre} {tipo}"))
        lotes = {c["name"] for c in inspect(engine).get_columns("lotes_insumo")}
        if "certificacion_id" not in lotes:
            conn.execute(text(
                "ALTER TABLE lotes_insumo ADD COLUMN certificacion_id INTEGER "
                "REFERENCES certificaciones_proveedor(id)"
            ))
        conn.execute(text(
            "UPDATE proveedores SET cuit = matricula WHERE cuit IS NULL AND matricula IS NOT NULL"
        ))
