"""Qué cantidades tienen sentido para una unidad de medida."""

from decimal import Decimal

from src.unidadMedida.constants import TIPO_UNIDAD


def admite_fracciones(unidad) -> bool:
    """False si la unidad cuenta piezas (un, docena): no hay 66,1 panes."""
    return unidad is None or unidad.tipo != TIPO_UNIDAD


def es_cantidad_valida(cantidad: Decimal, unidad) -> bool:
    """True si la cantidad se puede expresar en esa unidad.

    Para las unidades que cuentan piezas, lo que tiene que ser entero es la
    cantidad de piezas: 1,5 docenas son 18 unidades y vale; 2,5 unidades no.
    """
    if admite_fracciones(unidad):
        return True
    piezas = Decimal(cantidad) * Decimal(str(unidad.factor_a_base or 1))
    return piezas == piezas.to_integral_value()
