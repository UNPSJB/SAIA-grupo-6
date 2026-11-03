"""Formateo de celdas para exportación (CSV/PDF).

Reutiliza los mismos criterios de seguridad y legibilidad que la bitácora de
auditoría (`src.auditoria.exportar`):
* BOM + UTF-8 para que Excel reconozca la codificación.
* Separador ";" (configuración regional en español).
* Protección contra inyección de fórmulas en Excel (CSV injection).
* Celdas vacías como "vacío", booleans como Sí/No.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any, Iterator

# Excel abre el CSV con el separador de la configuración regional (en
# español es ";"), y necesita BOM para reconocer UTF-8.
SEPARADOR_CSV = ";"
BOM = "\ufeff"


def texto(valor: Any) -> str:
    """Convierte un valor de celda a texto legible para mostrar."""
    if valor is None or valor == "":
        return "vacío"
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y %H:%M")
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def seguro(valor: str) -> str:
    """Evita que Excel interprete el texto como una fórmula (CSV injection).

    Recorta al límite de una celda de Excel (32767 caracteres) y antepone
    un apóstrofo si el valor comienza por un carácter peligroso.
    """
    valor = valor[:32000]
    if valor and valor[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + valor
    return valor


def generar_csv(
    filas: list[list[str]], encabezados: list[str]
) -> Iterator[str]:
    """Genera el CSV por tramos, sin armar todo en memoria.

    Igual que `src.auditoria.exportar.generar_csv`: escribe el BOM y la
    cabecera una vez, y va cediendo una fila por iteración.
    """
    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=SEPARADOR_CSV, lineterminator="\r\n")
    buffer.write(BOM)
    escritor.writerow(encabezados)
    yield buffer.getvalue()
    for fila in filas:
        buffer.seek(0)
        buffer.truncate(0)
        escritor.writerow([seguro(c) for c in fila])
        yield buffer.getvalue()
