"""Cálculo de estados de certificaciones.

Los estados NUNCA se guardan en la base: se derivan de `activa`,
`anulada` y `fecha_vencimiento` cada vez que se consulta. Este módulo no
conoce el modelo `Transportista` (ni el de proveedores): recibe cualquier
objeto con esos atributos, para poder reutilizarlo en otros módulos.
"""

from datetime import date
from typing import Iterable, Protocol

from src.common.fechas import hoy

# Estado individual de una certificación.
ESTADO_VIGENTE = "Vigente"
ESTADO_VENCIDA = "Vencida"
ESTADO_REEMPLAZADA = "Reemplazada"
ESTADO_ANULADA = "Anulada"

# Estado global de habilitación de una entidad (transportista, proveedor).
ESTADO_SIN_CERTIFICACIONES = "Sin certificaciones"
ESTADO_CERTIFICACION_VENCIDA = "Certificación vencida"
ESTADO_HABILITADO = "Habilitado"


class CertificacionParaEstado(Protocol):
    """Atributos mínimos que necesita el cálculo de estados."""

    activa: bool
    anulada: bool
    fecha_vencimiento: date


def estado_certificacion(
    certificacion: CertificacionParaEstado,
    fecha_referencia: date | None = None,
) -> str:
    """Estado visible de una certificación.

    Una certificación anulada siempre se muestra como "Anulada", incluso si
    por un error de datos quedó con `activa=True`. Si no está anulada pero
    `activa=False`, fue reemplazada por una renovación.
    """
    if getattr(certificacion, "anulada", False):
        return ESTADO_ANULADA
    if not certificacion.activa:
        return ESTADO_REEMPLAZADA

    referencia = fecha_referencia or hoy()
    # Vigente hasta el final del día de vencimiento: por eso `>=`.
    if certificacion.fecha_vencimiento >= referencia:
        return ESTADO_VIGENTE
    return ESTADO_VENCIDA


def estado_habilitacion(
    certificaciones: Iterable[CertificacionParaEstado],
    fecha_referencia: date | None = None,
) -> str:
    """Estado global de habilitación según las certificaciones activas.

    - "Sin certificaciones": no hay ninguna activa.
    - "Certificación vencida": hay al menos una activa vencida.
    - "Habilitado": hay al menos una activa y todas están vigentes.
    """
    referencia = fecha_referencia or hoy()
    activas = [
        certificacion
        for certificacion in certificaciones
        if certificacion.activa and not getattr(certificacion, "anulada", False)
    ]

    if not activas:
        return ESTADO_SIN_CERTIFICACIONES
    if any(certificacion.fecha_vencimiento < referencia for certificacion in activas):
        return ESTADO_CERTIFICACION_VENCIDA
    return ESTADO_HABILITADO
