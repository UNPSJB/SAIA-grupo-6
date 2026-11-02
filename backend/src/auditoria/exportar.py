"""Exportación de la bitácora de auditoría a CSV o PDF."""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from src.auditoria.schemas import AuditLogItem
from src.auditoria.services import _zona_local

ENCABEZADOS = [
    "ID evento",
    "Fecha",
    "Hora",
    "Usuario ID",
    "Usuario",
    "Entidad",
    "ID registro",
    "Acción",
    "Registro",
    "Cambios",
]

# Excel abre el CSV con el separador de la configuración regional (en
# español es ";"), y necesita BOM para reconocer UTF-8.
SEPARADOR_CSV = ";"
BOM = "\ufeff"


def _texto(valor: Any) -> str:
    if valor is None or valor == "":
        return "vacío"
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    return str(valor)


def _seguro(valor: str) -> str:
    """Evita que Excel interprete el texto como una fórmula (CSV injection)."""
    valor = valor[:32000]  # límite de una celda de Excel: 32767 caracteres
    if valor and valor[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + valor
    return valor


def _cambios(item: AuditLogItem) -> str:
    partes = []
    if item.cambios_detalle:
        for campo, c in item.cambios_detalle.items():
            antes = f"{c.antes_nombre} (#{c.antes})" if c.antes_nombre else _texto(c.antes)
            despues = f"{c.despues_nombre} (#{c.despues})" if c.despues_nombre else _texto(c.despues)
            partes.append(f"{campo}: {antes} → {despues}")
    elif item.cambios:
        for campo, valores in item.cambios.items():
            antes, despues = (list(valores) + [None, None])[:2]
            partes.append(f"{campo}: {_texto(antes)} → {_texto(despues)}")
    return " | ".join(partes)


def _fila(item: AuditLogItem) -> list[str]:
    fecha = item.fecha
    if fecha.tzinfo is None:
        fecha = fecha.replace(tzinfo=timezone.utc)
    local = fecha.astimezone(_zona_local())
    return [
        str(item.id),
        local.strftime("%d/%m/%Y"),
        local.strftime("%H:%M:%S"),
        str(item.usuario_id) if item.usuario_id is not None else "",
        item.usuario_nombre or ("" if item.usuario_id else "Sistema"),
        item.entidad,
        item.entidad_id,
        item.accion,
        (item.registro.etiqueta or "") if item.registro else "",
        _cambios(item),
    ]


def generar_csv(items: Iterable[AuditLogItem]) -> Iterator[str]:
    """Genera el CSV por tramos, sin armar todo en memoria."""
    buffer = io.StringIO()
    escritor = csv.writer(buffer, delimiter=SEPARADOR_CSV, lineterminator="\r\n")
    buffer.write(BOM)
    escritor.writerow(ENCABEZADOS)
    yield buffer.getvalue()
    for item in items:
        buffer.seek(0)
        buffer.truncate(0)
        escritor.writerow([_seguro(c) for c in _fila(item)])
        yield buffer.getvalue()


COLUMNAS_PDF = [
    ("ID", 12),
    ("Fecha", 18),
    ("Hora", 16),
    ("Usuario", 34),
    ("Entidad", 28),
    ("ID reg.", 16),
    ("Acción", 22),
    ("Registro", 40),
    ("Cambios", 91),
]
INDICES_PDF = (0, 1, 2, 4, 5, 6, 7, 8, 9)
MAX_CAMBIOS_PDF = 400


def generar_pdf(items: Iterable[AuditLogItem]) -> bytes:
    estilos = getSampleStyleSheet()
    celda = ParagraphStyle("celda", parent=estilos["BodyText"], fontSize=7, leading=8.5)
    cabecera = ParagraphStyle(
        "cabecera", parent=celda, textColor=colors.white, fontName="Helvetica-Bold"
    )

    def parrafo(texto: str, estilo: ParagraphStyle) -> Paragraph:
        return Paragraph(escape(texto), estilo)

    filas = [[parrafo(nombre, cabecera) for nombre, _ in COLUMNAS_PDF]]
    for item in items:
        valores = _fila(item)
        fila = []
        for i in INDICES_PDF:
            texto = valores[i]
            if i == 9 and len(texto) > MAX_CAMBIOS_PDF:
                texto = texto[: MAX_CAMBIOS_PDF - 1] + "…"
            fila.append(parrafo(texto, celda))
        filas.append(fila)

    salida = io.BytesIO()
    doc = SimpleDocTemplate(
        salida,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title="Bitácora de auditoría",
    )
    tabla = Table(filas, colWidths=[ancho * mm for _, ancho in COLUMNAS_PDF], repeatRows=1)
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
    generado = datetime.now(_zona_local()).strftime("%d/%m/%Y %H:%M")
    doc.build(
        [
            Paragraph("Bitácora de auditoría", estilos["Title"]),
            Paragraph(
                f"Generado el {generado} · {len(filas) - 1} registros",
                estilos["Normal"],
            ),
            Spacer(1, 4 * mm),
            tabla,
        ]
    )
    return salida.getvalue()
