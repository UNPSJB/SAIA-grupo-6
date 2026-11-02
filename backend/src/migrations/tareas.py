from .base import agregar_columna, tablas


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
        agregar_columna("tareas", "tipo", "VARCHAR(30) NOT NULL DEFAULT 'operacional'")
        agregar_columna("tareas", "observaciones", "TEXT")

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
