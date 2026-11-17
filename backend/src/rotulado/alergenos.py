"""Catálogo técnico versionado del art. 235 séptimo del CAA.

Fuente: https://www.argentina.gob.ar/anmat/regulados/alimentos/alergenos-alimentarios/elaboradores-de-alimentos
No infiere excepciones, eliminación en proceso ni concentraciones de sulfitos.
"""

VERSION_REGLAS = "caa-235-septimo-2025-06-v1"
NOMBRES = {
    "trigo": "Trigo", "centeno": "Centeno", "cebada": "Cebada", "avena": "Avena",
    "crustaceos": "Crustáceos", "huevo": "Huevo", "pescado": "Pescado",
    "mani": "Maní", "soja": "Soja", "leche": "Leche",
    "almendra": "Almendra", "avellana": "Avellana", "castana": "Castaña",
    "castana_caju": "Castaña de cajú", "nuez_brasil": "Nuez de Brasil",
    "nuez": "Nuez", "pecan": "Pecán", "pistacho": "Pistacho",
    "sulfitos": "Dióxido de azufre y sulfitos",
}


def catalogo():
    return [{"codigo": codigo, "nombre": nombre, "condicionada": codigo == "sulfitos"}
            for codigo, nombre in NOMBRES.items()]
