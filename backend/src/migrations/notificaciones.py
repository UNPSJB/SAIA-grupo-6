from sqlalchemy import text

from src.database import engine

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
    # Motor de riesgos (Impacto × Probabilidad).
    nuevas = [
        agregar_columna(tabla, "impacto", "INTEGER NOT NULL DEFAULT 1"),
        agregar_columna(tabla, "recurrencia", "INTEGER NOT NULL DEFAULT 1"),
        agregar_columna(tabla, "persistencia", "INTEGER NOT NULL DEFAULT 1"),
        agregar_columna(tabla, "probabilidad", "FLOAT NOT NULL DEFAULT 1.0"),
        agregar_columna(tabla, "puntaje", "FLOAT NOT NULL DEFAULT 1.0"),
        agregar_columna(tabla, "detectada_en", "DATE"),
        # Plan de acción que tiene la situación bajo control (riesgo tratado).
        agregar_columna(tabla, "plan_tratamiento_id", "INTEGER"),
    ]
    # Las filas que ya existían quedaron con puntajes por defecto: se marca la
    # tabla como desactualizada para que la primera lectura las recalcule.
    if any(nuevas) and "estado_notificaciones" in tablas():
        with engine.begin() as conexion:
            conexion.execute(text("UPDATE estado_notificaciones SET sucio = 1"))
