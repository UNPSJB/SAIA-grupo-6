"""Funciones puras del cálculo: conversión de unidades, redondeo y textos.

No tocan la base: reciben los parámetros ya leídos. Así el redondeo se prueba
sin armar recetas, y cambiar un parámetro en la app cambia el resultado sin
tocar este archivo.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from src.nutricion.constants import CONVERSIONES

CIEN = Decimal("100")


@dataclass(frozen=True)
class ReglaNutriente:
    clave: str
    nombre: str
    unidad: str
    valor_diario: Decimal | None
    umbral_no_significativo: Decimal | None
    decimales_menor_10: int
    decimales_desde_10: int


def tipo_unidad(simbolo: str | None, nombre: str | None = None) -> tuple[str, Decimal] | None:
    """(masa|volumen|unidad, factor a g o ml) o None si no se puede convertir."""
    for texto in (simbolo, nombre):
        if texto:
            encontrado = CONVERSIONES.get(texto.strip().lower())
            if encontrado:
                return encontrado
    return None


def redondear(valor: Decimal, decimales: int) -> Decimal:
    return valor.quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)


def texto_numero(valor: Decimal, decimales: int) -> str:
    """Número con coma decimal (es-AR) y separador de miles con punto."""
    redondeado = redondear(valor, decimales)
    entero, _, fraccion = f"{redondeado:,.{decimales}f}".partition(".")
    entero = entero.replace(",", ".")
    return f"{entero},{fraccion}" if fraccion else entero


def decimales_para(valor: Decimal, regla: ReglaNutriente) -> int:
    return regla.decimales_menor_10 if abs(valor) < 10 else regla.decimales_desde_10


def es_no_significativo(por_porcion: Decimal | None, regla: ReglaNutriente) -> bool:
    """La norma mira la porción: si no hay porción, se mira por 100 g."""
    if regla.umbral_no_significativo is None or por_porcion is None:
        return False
    return por_porcion <= regla.umbral_no_significativo


def expresar(valor: Decimal | None, regla: ReglaNutriente, no_significativo: bool) -> str:
    """Un no significativo se declara cero con los decimales de su tramo ("0,0 g"),
    como en el rótulo de referencia de la cátedra."""
    if valor is None:
        return "—"
    if no_significativo:
        return texto_numero(Decimal(0), regla.decimales_menor_10)
    return texto_numero(valor, decimales_para(valor, regla))


def porcentaje_vd(
    por_porcion: Decimal | None, regla: ReglaNutriente, no_significativo: bool
) -> tuple[Decimal | None, str]:
    """(%VD redondeado a entero, texto). Sin VD establecido queda en blanco
    (azúcares y grasas trans no declaran %VD)."""
    if regla.valor_diario is None:
        return None, ""
    if por_porcion is None:
        return None, "—"
    if no_significativo:
        return Decimal(0), "0"
    vd = redondear(por_porcion / regla.valor_diario * CIEN, 0)
    return vd, texto_numero(vd, 0)


def texto_energia(
    kcal: Decimal | None, regla: ReglaNutriente, factor_kj: Decimal, no_significativo: bool
) -> str:
    """"123 kcal = 517 kJ": la energía se declara en las dos unidades."""
    if kcal is None:
        return "—"
    if no_significativo:
        return "0 kcal = 0 kJ"
    kj = kcal * factor_kj
    return (
        f"{texto_numero(kcal, decimales_para(kcal, regla))} kcal = "
        f"{texto_numero(kj, decimales_para(kj, regla))} kJ"
    )
