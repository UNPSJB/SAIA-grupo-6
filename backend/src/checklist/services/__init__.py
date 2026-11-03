"""Servicios del checklist, divididos por responsabilidad.

  * generacion: crea el checklist del día a partir de los planes activos.
  * tareas_del_dia: listado de tareas pendientes del día.
  * marcado: marcar/desmarcar tareas, historial de un registro y cobertura.
  * historial: historial de checklists y su detalle.
  * consumo: consumo acumulado de productos de limpieza.

El router usa `services.<función>`; este módulo reexporta lo público.
"""

from .consumo import listar_consumo_insumos
from .generacion import obtener_o_crear_checklists_del_dia
from .historial import (
    conteo_cumplimiento_periodo,
    listar_historial_checklists,
    obtener_detalle_checklist,
)
from .marcado import (
    asignar_cobertura_tarea,
    marcar_tarea,
    obtener_historial_registro,
)
from .tareas_del_dia import listar_tareas_del_dia

__all__ = [
    "asignar_cobertura_tarea",
    "conteo_cumplimiento_periodo",
    "listar_consumo_insumos",
    "listar_historial_checklists",
    "listar_tareas_del_dia",
    "marcar_tarea",
    "obtener_detalle_checklist",
    "obtener_historial_registro",
    "obtener_o_crear_checklists_del_dia",
]
