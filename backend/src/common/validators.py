"""Validadores compartidos por los schemas del dominio.

Antes cada módulo repetía la misma expresión regular y el mismo esqueleto de
`field_validator`. Estos helpers concentran el patrón: cada módulo pasa sus
propias excepciones y el comportamiento queda uniforme.

Regla que respetan todos los helpers: **`None` se devuelve sin tocar**. Los
schemas `*Update` ensanchan su `*Base` y vuelven opcionales los campos que
heredan validadores, así que un `null` explícito en el body llega al validador.
Si no se contemplate, `v.strip()` explota con `AttributeError` y la validación
de Pydantic (que solo convierte `ValueError`) deja escapar un 500 en vez de un 400.
"""

import re
from typing import Callable, Optional

# Nombres que admiten letras, dígitos y separadores habituales.
RE_NOMBRE_GENERICO = r"^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ \-\.()]+$"
# Nombres de solo letras y espacios (personas, planes, tareas).
RE_NOMBRE_SOLO_LETRAS = r"^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$"
RE_DNI = r"^\d{7,8}$"
RE_EMAIL = r"^[\w\.-]+@[\w\.-]+\.\w+$"


def texto_obligatorio(
    v: Optional[str],
    *,
    invalido: Callable[[], Exception],
    vacio: Optional[Callable[[], Exception]] = None,
    patron: str = RE_NOMBRE_GENERICO,
    exigir_alfabetico: bool = False,
) -> Optional[str]:
    """Valida y normaliza (recorta) un texto obligatorio.

    `vacio` e `invalido` son callables que devuelven la excepción a lanzar:
    cada módulo pasa las suyas para conservar sus mensajes.

    `exigir_alfabetico` además rechaza textos formados solo por dígitos o
    separadores (usado por las unidades de medida, donde "..." no es un nombre).
    """
    if v is None:
        return None

    texto = v.strip()
    if not texto:
        if vacio is not None:
            raise vacio()
        raise invalido()

    if not re.match(patron, texto):
        raise invalido()

    if exigir_alfabetico and not re.search(r"[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]", texto):
        raise invalido()

    return texto


def texto_no_vacio(v: Optional[str], *, vacio: Callable[[], Exception]) -> Optional[str]:
    """Valida que el texto tenga contenido sin imponer un patrón."""
    if v is None:
        return None
    texto = v.strip()
    if not texto:
        raise vacio()
    return texto


def texto_opcional(v: Optional[str], *, largo_maximo: Optional[int] = None) -> Optional[str]:
    """Recorta un texto libre y lo deja en `None` si queda vacío."""
    if v is None:
        return None
    texto = v.strip()
    if largo_maximo is not None:
        texto = texto[:largo_maximo]
    return texto or None


def id_positivo(v: Optional[int], *, invalido: Callable[[], Exception]) -> Optional[int]:
    """Valida que un id sea mayor a cero. Tolera `None` en los `*Update`."""
    if v is None:
        return None
    if v <= 0:
        raise invalido()
    return v


def dni_valido(v: Optional[str], *, invalido: Callable[[], Exception]) -> Optional[str]:
    if v is None:
        return None
    texto = v.strip()
    if not texto or not re.match(RE_DNI, texto):
        raise invalido()
    return texto


def email_valido(v: Optional[str], *, invalido: Callable[[], Exception]) -> Optional[str]:
    if v is None:
        return None
    texto = v.strip()
    if not texto or not re.match(RE_EMAIL, texto):
        raise invalido()
    return texto