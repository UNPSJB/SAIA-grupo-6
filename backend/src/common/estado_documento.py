"""Clasificación única del estado de un documento por su vencimiento.

Toda la aplicación debe coincidir en si un documento está vencido, próximo a
vencer o vigente, para que la campana, el tablero de vencimientos y el motor
de criticidad nunca muestren estados distintos para el mismo documento.
"""

from datetime import date

# Estados devueltos.
VENCIDO = "VENCIDO"
PROXIMO = "PROXIMO"
VIGENTE = "VIGENTE"


def estado_documento(fecha_vencimiento: date | None, hoy: date, margen: int) -> str:
    """Devuelve el estado de un documento según su fecha de vencimiento.

    Criterio único (acordado):
      * `fecha_vencimiento` es None -> VIGENTE (sin fecha, no hay alerta).
      * Venció ayer o antes (dias < 0) -> VENCIDO.
      * Vence hoy (dias == 0) -> VIGENTE (plazo "vence hoy", no es una alerta).
      * Vence dentro del margen configurado (1 <= dias <= margen) -> PROXIMO.
      * Vence fuera del margen (dias > margen) -> VIGENTE.

    `margen` es el configurable de alertas de vencimiento (no un valor fijo de
    módulo).
    """
    if fecha_vencimiento is None:
        return VIGENTE

    dias = (fecha_vencimiento - hoy).days
    if dias < 0:
        return VENCIDO
    if 1 <= dias <= margen:
        return PROXIMO
    return VIGENTE
