from .base import agregar_columna, tablas


def migrar_documentos() -> None:
    if "versiones_documento" in tablas():
        agregar_columna("versiones_documento", "fecha_vencimiento", "DATE")
