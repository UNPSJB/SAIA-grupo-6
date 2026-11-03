"""Motor genérico de exportación de tablas a CSV/PDF.

No conoce tablas concretas: recibe una `ConfigTabla` (definida en
`configuracion.py` y poblada en `tablas.py`) y una sesión de base de datos,
y produce el archivo solicitado.

Funciones públicas:
* `exportar_csv(db, config, filtros)` -> iterador de str (streaming por tramos)
* `exportar_pdf(db, config, filtros)` -> bytes
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Any, Iterator

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import Boolean, asc, select
from sqlalchemy.orm import Session, load_only
from xml.sax.saxutils import escape

from src.exportacion.configuracion import ConfigTabla
from src.exportacion.formato import BOM, SEPARADOR_CSV, seguro, texto

# Lote de filas que se leen de la base por consulta al exportar sin paginar.
LOTE_EXPORTACION = 500


def _consulta_base(db: Session, config: ConfigTabla, filtros: dict[str, Any]):
    """Construye la consulta SELECT de la tabla con los filtros aplicados."""
    modelo = config.modelo
    columnas = [getattr(modelo, c.nombre) for c in config.campos]
    consulta = select(modelo).options(load_only(*columnas))

    for nombre, valor in filtros.items():
        if valor is None or valor == "":
            continue
        columna = getattr(modelo, nombre, None)
        if columna is None:
            continue
        if isinstance(valor, str) and isinstance(
            getattr(columna, "type", None), Boolean
        ):
            valor = valor.strip().lower() in ("true", "1", "t", "si", "sí")
        consulta = consulta.where(columna == valor)

    pk_col = getattr(modelo, config.pk, None)
    orden_col = getattr(modelo, config.orden_por, pk_col)
    if orden_col is not None:
        consulta = consulta.order_by(asc(orden_col))
    return consulta


def _iterar_filas(db: Session, config: ConfigTabla, filtros: dict[str, Any]):
    """Itera todas las filas que cumplen los filtros, en lotes, sin paginar."""
    consulta = _consulta_base(db, config, filtros)
    pagina = 1
    while True:
        filas = (
            db.execute(
                consulta.offset((pagina - 1) * LOTE_EXPORTACION).limit(LOTE_EXPORTACION)
            )
            .scalars()
            .all()
        )
        if not filas:
            return
        yield from filas
        if len(filas) < LOTE_EXPORTACION:
            return
        pagina += 1


def _formatear_fila(obj: Any, config: ConfigTabla) -> list[str]:
    """Convierte un objeto ORM en una lista de celdas de texto."""
    return [texto(getattr(obj, campo.nombre, None)) for campo in config.campos]


def exportar_csv(
    db: Session,
    config: ConfigTabla,
    filtros: dict[str, Any] | None = None,
) -> Iterator[str]:
    """Genera el CSV de la tabla por tramos, sin armar todo en memoria.

    Igual que `src.auditoria.exportar.generar_csv`: BOM, encabezados y una
    fila por iteración, con protección contra CSV injection.
    """
    filtros = filtros or {}
    encabezados = [campo.etiqueta for campo in config.campos]

    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=SEPARADOR_CSV, lineterminator="\r\n")
    buffer.write(BOM)
    escritor.writerow(encabezados)
    yield buffer.getvalue()

    for obj in _iterar_filas(db, config, filtros):
        buffer.seek(0)
        buffer.truncate(0)
        escritor.writerow([seguro(c) for c in _formatear_fila(obj, config)])
        yield buffer.getvalue()


def exportar_pdf(
    db: Session,
    config: ConfigTabla,
    filtros: dict[str, Any] | None = None,
) -> bytes:
    """Genera el PDF de la tabla con reportlab (misma estética que auditoría)."""
    filtros = filtros or {}
    filas_orm = list(_iterar_filas(db, config, filtros))
    encabezados = [campo.etiqueta for campo in config.campos]
    filas = [_formatear_fila(obj, config) for obj in filas_orm]
    anchos = [campo.ancho_pdf or 22 for campo in config.campos]
    return pdf_desde_filas(config.etiqueta, encabezados, filas, anchos)


def pdf_desde_filas(
    titulo: str,
    encabezados: list[str],
    filas: list[list[str]],
    anchos_mm: list[float] | None = None,
) -> bytes:
    """PDF de una tabla ya armada (encabezados + filas de texto).

    Sin `anchos_mm`, las columnas se reparten el ancho útil de la hoja.
    """
    estilos = getSampleStyleSheet()
    celda = ParagraphStyle("celda", parent=estilos["BodyText"], fontSize=7, leading=8.5)
    cabecera = ParagraphStyle(
        "cabecera", parent=celda, textColor=colors.white, fontName="Helvetica-Bold"
    )

    filas_pdf = [[parrafo(nombre, cabecera) for nombre in encabezados]]
    for fila in filas:
        filas_pdf.append([parrafo(valor, celda) for valor in fila])

    if anchos_mm is None:
        anchos_mm = [277 / max(len(encabezados), 1)] * len(encabezados)
    anchos = [ancho * mm for ancho in anchos_mm]

    salida = io.BytesIO()
    doc = SimpleDocTemplate(
        salida,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title=f"{titulo} - Exportación",
    )
    tabla = Table(filas_pdf, colWidths=list(anchos), repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    generado = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y %H:%M")
    doc.build(
        [
            Paragraph(titulo, estilos["Title"]),
            Paragraph(
                f"Generado el {generado} · {len(filas)} registros",
                estilos["Normal"],
            ),
            Spacer(1, 4 * mm),
            tabla,
        ]
    )
    return salida.getvalue()

def parrafo(texto_valor: str, estilo: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(texto_valor), estilo)
