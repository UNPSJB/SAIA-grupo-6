from sqlalchemy import text

from .base import columnas_de, tablas
from src.database import engine


def migrar_checklist_consumos() -> None:
    """Varios productos químicos y elementos de limpieza por tarea.

    Antes cada `registro_tareas` guardaba un solo producto con su cantidad
    (`insumo_quimico_id`, `cantidad_consumida`) y un solo elemento
    (`elemento_limpieza_id`). Ahora van en `registro_tarea_consumos` y
    `registro_tarea_elementos` (las crea `create_all`).

    Se MUEVEN los valores viejos a las tablas nuevas y las columnas viejas
    quedan en NULL: si solo se copiaran, al desmarcar una tarea (que vacía las
    tablas nuevas) un nuevo arranque volvería a copiar el consumo viejo. El
    stock no se toca: los movimientos de esos consumos ya están registrados.
    """
    existentes = tablas()
    if not {"registro_tareas", "registro_tarea_consumos", "registro_tarea_elementos"} <= existentes:
        return
    columnas = columnas_de("registro_tareas")
    # La fila nueva es de la misma sede que su tarea: sin esto el default de la
    # columna la dejaba en la principal.
    con_sede = "establecimiento_id" in columnas and all(
        "establecimiento_id" in columnas_de(t)
        for t in ("registro_tarea_consumos", "registro_tarea_elementos")
    )
    columna_sede = ", establecimiento_id" if con_sede else ""
    valor_sede = ", r.establecimiento_id" if con_sede else ""

    with engine.begin() as conexion:
        if {"insumo_quimico_id", "cantidad_consumida"} <= columnas:
            conexion.execute(
                text(
                    "INSERT INTO registro_tarea_consumos "
                    f"(registro_tarea_id, insumo_quimico_id, cantidad{columna_sede}) "
                    f"SELECT r.id, r.insumo_quimico_id, r.cantidad_consumida{valor_sede} FROM registro_tareas r "
                    "WHERE r.insumo_quimico_id IS NOT NULL AND r.cantidad_consumida > 0 "
                    "AND NOT EXISTS (SELECT 1 FROM registro_tarea_consumos c "
                    "  WHERE c.registro_tarea_id = r.id AND c.insumo_quimico_id = r.insumo_quimico_id)"
                )
            )
            conexion.execute(
                text(
                    "UPDATE registro_tareas SET insumo_quimico_id = NULL, cantidad_consumida = NULL "
                    "WHERE insumo_quimico_id IS NOT NULL OR cantidad_consumida IS NOT NULL"
                )
            )
        if "elemento_limpieza_id" in columnas:
            conexion.execute(
                text(
                    "INSERT INTO registro_tarea_elementos "
                    f"(registro_tarea_id, elemento_limpieza_id{columna_sede}) "
                    f"SELECT r.id, r.elemento_limpieza_id{valor_sede} FROM registro_tareas r "
                    "WHERE r.elemento_limpieza_id IS NOT NULL "
                    "AND NOT EXISTS (SELECT 1 FROM registro_tarea_elementos e "
                    "  WHERE e.registro_tarea_id = r.id AND e.elemento_limpieza_id = r.elemento_limpieza_id)"
                )
            )
            conexion.execute(
                text(
                    "UPDATE registro_tareas SET elemento_limpieza_id = NULL "
                    "WHERE elemento_limpieza_id IS NOT NULL"
                )
            )
