from sqlalchemy import text

from .base import agregar_columna, columnas_de, tablas
from src.database import engine


def migrar_tareas() -> None:
    """Tareas y el registro de tareas del checklist.

    `tareas.tipo` es NOT NULL con default: las que ya existían quedan como
    operacionales (el default histórico).

    El checklist es una foto de la tarea al generarse, por eso las columnas
    `*_historico` quedan en NULL en las filas viejas: acá no se puede inventar
    un valor del pasado.
    """
    existentes = tablas()

    if "tareas" in existentes:
        columnas = columnas_de("tareas")
        agregar_columna("tareas", "tipo", "VARCHAR(30) NOT NULL DEFAULT 'operacional'")
        agregar_columna("tareas", "observaciones", "TEXT")

        if "operador_id" not in columnas:
            agregar_columna(
                "tareas",
                "operador_id",
                "INTEGER REFERENCES personal(id) ON DELETE SET NULL",
            )
        # Las bases nuevas lo crean desde el modelo; las antiguas necesitan el
        # índice después de sumar la columna durante la migración.
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_tareas_operador_id "
                    "ON tareas (operador_id)"
                )
            )

    if "registro_tareas" in existentes:
        agregar_columna(
            "registro_tareas",
            "elemento_limpieza_id",
            "INTEGER REFERENCES elementos_limpieza(id) ON DELETE SET NULL",
        )
        # Instalaciones anteriores al informe de consumo tienen la tabla sin
        # estas columnas: create_all no altera tablas existentes.
        agregar_columna(
            "registro_tareas",
            "insumo_quimico_id",
            "INTEGER REFERENCES insumos_quimicos(id) ON DELETE SET NULL",
        )
        agregar_columna("registro_tareas", "cantidad_consumida", "FLOAT")
        agregar_columna(
            "registro_tareas", "version_stock", "INTEGER NOT NULL DEFAULT 0"
        )
        agregar_columna("registro_tareas", "tipo_tarea_historico", "VARCHAR(30)")
        agregar_columna("registro_tareas", "observaciones_tarea_historico", "TEXT")

    if "registro_tareas" in existentes:
        columnas_rt = columnas_de("registro_tareas")
        if "operador_id" not in columnas_rt:
            agregar_columna(
                "registro_tareas",
                "operador_id",
                "INTEGER REFERENCES personal(id) ON DELETE SET NULL",
            )
        if "reemplazado_por_id" not in columnas_rt:
            agregar_columna(
                "registro_tareas",
                "reemplazado_por_id",
                "INTEGER REFERENCES personal(id) ON DELETE SET NULL",
            )
