from .base import agregar_columna, tablas


def migrar_notificaciones() -> None:
    """Columnas nuevas de notificaciones_persistidas en tablas de versiones
    anteriores que no las tenían."""
    if "notificaciones_persistidas" not in tablas():
        return
    tabla = "notificaciones_persistidas"
    agregar_columna(tabla, "criticidad", "VARCHAR(10) NOT NULL DEFAULT 'baja'")
    agregar_columna(tabla, "motivo", "VARCHAR(300) NOT NULL DEFAULT ''")
    agregar_columna(tabla, "plazo", "VARCHAR(60)")
    agregar_columna(tabla, "recambio_id", "INTEGER")
