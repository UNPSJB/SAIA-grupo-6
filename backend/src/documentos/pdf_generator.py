"""Generador reutilizable de PDF de prueba con la estética institucional de SAIA.

Cada documento de prueba generado por Faker obtiene un archivo PDF propio,
individual, con su información correspondiente y un diseño de ficha
institucional. Los datos técnicos se marcan explícitamente como
"información de demostración" y no constituyen certificaciones, resultados de
inspección, conformidades legales ni mediciones reales.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, Spacer, Table, TableStyle

from src.documentos.constants import TipoDocumento


# --------------------------------------------------------------------------
# Paleta institucional SAIA (azul verdoso sobre fondo blanco)
# --------------------------------------------------------------------------

PRIMARY = colors.HexColor("#0F6B6B")
PRIMARY_DARK = colors.HexColor("#0A4A4A")
PRIMARY_LIGHT = colors.HexColor("#EAF4F4")
BORDER = colors.HexColor("#B8D8D8")
ACCENT = colors.HexColor("#147D8C")
SUAVE = colors.HexColor("#CFE9E9")
WHITE = colors.white

TEXT = colors.HexColor("#1F2937")
TEXT_MUTED = colors.HexColor("#5B6B6B")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGEN = 18 * mm
ANCHO = PAGE_WIDTH - 2 * MARGEN
ALTO_BANDA = 26 * mm

NOTA_DEMO = (
    "Información de demostración — datos simulados con fines de prueba. "
    "No constituyen certificaciones, resultados de inspección, conformidades "
    "legales ni mediciones reales."
)


@dataclass
class ContextoDocumento:
    """Datos necesarios para armar el PDF de un documento / versión."""

    nombre: str
    tipo: str
    numero_version: int
    identificador: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    estado: str = "vigente"
    autor: Optional[str] = None
    documento_id: Optional[int] = None
    fecha_subida: Optional[datetime] = None


# --------------------------------------------------------------------------
# Estilos
# --------------------------------------------------------------------------

def _estilos() -> dict[str, ParagraphStyle]:
    return {
        "saia": ParagraphStyle(
            "saia", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=WHITE
        ),
        "subtitulo": ParagraphStyle(
            "subtitulo",
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=SUAVE,
        ),
        "titulo": ParagraphStyle(
            "titulo",
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=21,
            textColor=PRIMARY_DARK,
            spaceAfter=2,
        ),
        "tipo": ParagraphStyle(
            "tipo", fontName="Helvetica", fontSize=9.5, leading=12, textColor=TEXT_MUTED
        ),
        "seccion": ParagraphStyle(
            "seccion",
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=PRIMARY,
            spaceBefore=9,
            spaceAfter=4,
        ),
        "cuerpo": ParagraphStyle(
            "cuerpo", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=TEXT, spaceAfter=5
        ),
        "etiqueta": ParagraphStyle(
            "etiqueta",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=PRIMARY_DARK,
        ),
        "valor": ParagraphStyle(
            "valor", fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT
        ),
        "demo": ParagraphStyle(
            "demo",
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=10,
            textColor=TEXT_MUTED,
        ),
        "tabla_cabecera": ParagraphStyle(
            "tabla_cabecera",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=WHITE,
        ),
        "tabla_celda": ParagraphStyle(
            "tabla_celda", fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXT
        ),
    }


# --------------------------------------------------------------------------
# Marco de página (encabezado + pie)
# --------------------------------------------------------------------------

def _dibujar_marco(canvas_obj, _doc):
    """Encabezado institucional y pie de página con número de hoja."""
    canvas_obj.saveState()

    # ---- Encabezado ----
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.rect(0, PAGE_HEIGHT - ALTO_BANDA, PAGE_WIDTH, ALTO_BANDA, stroke=0, fill=1)
    canvas_obj.setFillColor(ACCENT)
    canvas_obj.rect(0, PAGE_HEIGHT - ALTO_BANDA - 2.5, PAGE_WIDTH, 2.5, stroke=0, fill=1)

    canvas_obj.setFillColor(WHITE)
    canvas_obj.setFont("Helvetica-Bold", 22)
    canvas_obj.drawString(MARGEN, PAGE_HEIGHT - 14 * mm, "SAIA")
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.setFillColor(SUAVE)
    canvas_obj.drawString(
        MARGEN, PAGE_HEIGHT - 20.5 * mm, "Sistema de Apoyo a la Inocuidad Alimentaria"
    )

    # ---- Pie de página ----
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.setLineWidth(0.6)
    canvas_obj.line(MARGEN, 15 * mm, PAGE_WIDTH - MARGEN, 15 * mm)
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.drawString(
        MARGEN, 9 * mm, "SAIA - Sistema de Apoyo a la Inocuidad Alimentaria"
    )
    canvas_obj.drawRightString(
        PAGE_WIDTH - MARGEN, 9 * mm, f"Página {canvas_obj.getPageNumber()}"
    )

    canvas_obj.restoreState()


# --------------------------------------------------------------------------
# Utilidades de contenido
# --------------------------------------------------------------------------

def _legible_tipo(tipo: str) -> str:
    return {
        TipoDocumento.FICHA_TECNICA.value: "Ficha técnica",
        TipoDocumento.MANUAL_BPM.value: "Manual de Buenas Prácticas",
        TipoDocumento.PROCEDIMIENTO.value: "Procedimiento",
        TipoDocumento.RECETA.value: "Receta",
    }.get(tipo, tipo)


def _legible_estado(estado: str) -> str:
    return {
        "vigente": "Vigente",
        "vencido": "Vencido",
        "archivado": "Archivado",
    }.get(estado, estado)


def _fila_info(etiqueta: str, valor: str, estilos: dict) -> list:
    return [Paragraph(escape(etiqueta), estilos["etiqueta"]), Paragraph(escape(valor), estilos["valor"])]


def _tarjeta_info(ctx: ContextoDocumento, estilos: dict) -> Table:
    filas: list = []
    filas.append(_fila_info("Nombre del documento", ctx.nombre, estilos))
    filas.append(_fila_info("Categoría", _legible_tipo(ctx.tipo), estilos))
    if ctx.identificador:
        filas.append(_fila_info("Identificador", ctx.identificador, estilos))
    filas.append(_fila_info("Versión", str(ctx.numero_version), estilos))
    if ctx.fecha_emision:
        filas.append(_fila_info("Fecha de emisión", ctx.fecha_emision.strftime("%d/%m/%Y"), estilos))
    if ctx.fecha_vencimiento:
        filas.append(_fila_info("Fecha de vencimiento", ctx.fecha_vencimiento.strftime("%d/%m/%Y"), estilos))
    filas.append(_fila_info("Estado", _legible_estado(ctx.estado), estilos))
    if ctx.autor:
        filas.append(_fila_info("Autor", ctx.autor, estilos))

    tabla = Table(filas, colWidths=[42 * mm, ANCHO - 42 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PRIMARY_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return tabla


# --------------------------------------------------------------------------
# Secciones según categoría
# --------------------------------------------------------------------------

def _ficha_tecnica(ctx: ContextoDocumento, estilos: dict):
    flujo = []
    flujo.append(Paragraph("1. Descripción del producto / equipo", estilos["seccion"]))
    flujo.append(
        Paragraph(
            f"Ficha técnica informativa de {escape(ctx.nombre)}. Este documento recopila "
            "los datos identificativos y las especificaciones de referencia del producto "
            "o equipo asociado.",
            estilos["cuerpo"],
        )
    )
    flujo.append(
        Paragraph("2. Especificaciones técnicas (información de demostración)", estilos["seccion"])
    )
    datos = [
        [
            Paragraph("Parámetro", estilos["tabla_cabecera"]),
            Paragraph("Valor", estilos["tabla_cabecera"]),
            Paragraph("Unidad", estilos["tabla_cabecera"]),
        ],
        [
            Paragraph("Capacidad nominal", estilos["tabla_celda"]),
            Paragraph("Valor ilustrativo (demo)", estilos["tabla_celda"]),
            Paragraph("—", estilos["tabla_celda"]),
        ],
        [
            Paragraph("Dimensiones", estilos["tabla_celda"]),
            Paragraph("Valor ilustrativo (demo)", estilos["tabla_celda"]),
            Paragraph("—", estilos["tabla_celda"]),
        ],
        [
            Paragraph("Peso", estilos["tabla_celda"]),
            Paragraph("Valor ilustrativo (demo)", estilos["tabla_celda"]),
            Paragraph("—", estilos["tabla_celda"]),
        ],
        [
            Paragraph("Material principal", estilos["tabla_celda"]),
            Paragraph("Valor ilustrativo (demo)", estilos["tabla_celda"]),
            Paragraph("—", estilos["tabla_celda"]),
        ],
        [
            Paragraph("Temperatura de operación", estilos["tabla_celda"]),
            Paragraph("Valor ilustrativo (demo)", estilos["tabla_celda"]),
            Paragraph("—", estilos["tabla_celda"]),
        ],
    ]
    tabla = Table(
        datos, colWidths=[55 * mm, 80 * mm, ANCHO - 55 * mm - 80 * mm]
    )
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PRIMARY_LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    flujo.append(tabla)
    flujo.append(Spacer(1, 3 * mm))
    flujo.append(Paragraph("3. Aplicación y uso recomendado", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "Uso conforme a las indicaciones del fabricante y los procedimientos internos "
            "del establecimiento.",
            estilos["cuerpo"],
        )
    )
    flujo.append(Paragraph("4. Cuidados y mantenimiento básicos", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "Realizar limpieza y revisión periódica según el plan de mantenimiento del sector.",
            estilos["cuerpo"],
        )
    )
    return flujo


def _manual(ctx: ContextoDocumento, estilos: dict):
    flujo = []
    flujo.append(Paragraph("1. Objetivo", estilos["seccion"]))
    flujo.append(
        Paragraph(
            f"Establecer las directrices de {escape(ctx.nombre)} para garantizar la "
            "inocuidad de los alimentos.",
            estilos["cuerpo"],
        )
    )
    flujo.append(Paragraph("2. Alcance", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "Aplica a todo el personal que intervenga en los procesos cubiertos por este manual.",
            estilos["cuerpo"],
        )
    )
    flujo.append(Paragraph("3. Recomendaciones generales", estilos["seccion"]))
    for rec in [
        "Mantener la higiene personal y del entorno de trabajo.",
        "Seguir las temperaturas de conservación establecidas.",
        "Evitar la contaminación cruzada entre alimentos crudos y cocidos.",
        "Registrar las actividades de manipulación y saneamiento.",
    ]:
        flujo.append(Paragraph(f"• {rec}", estilos["cuerpo"]))
    flujo.append(Paragraph("4. Responsabilidades", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "El responsable del área velará por el cumplimiento de lo dispuesto en este manual.",
            estilos["cuerpo"],
        )
    )
    return flujo


def _procedimiento(ctx: ContextoDocumento, estilos: dict):
    flujo = []
    flujo.append(Paragraph("1. Objetivo", estilos["seccion"]))
    flujo.append(
        Paragraph(f"Definir el procedimiento operativo de {escape(ctx.nombre)}.", estilos["cuerpo"])
    )
    flujo.append(Paragraph("2. Alcance", estilos["seccion"]))
    flujo.append(
        Paragraph("Aplica al personal asignado a las tareas descritas.", estilos["cuerpo"])
    )
    flujo.append(Paragraph("3. Responsables", estilos["seccion"]))
    flujo.append(
        Paragraph("El encargado del área y el operador designado.", estilos["cuerpo"])
    )
    flujo.append(
        Paragraph("4. Pasos del procedimiento (ejemplo de demostración)", estilos["seccion"])
    )
    pasos = [
        "Verificar que el área y los implementos estén limpios y desinfectados.",
        "Confirmar la disponibilidad de los insumos necesarios.",
        "Ejecutar la operación siguiendo las instrucciones de trabajo.",
        "Registrar la realización y cualquier observación en el formulario correspondiente.",
    ]
    for i, paso in enumerate(pasos, 1):
        flujo.append(Paragraph(f"{i}. {paso}", estilos["cuerpo"]))
    flujo.append(Paragraph("5. Registros y evidencias", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "Completar el formato de control asociado al finalizar el procedimiento.",
            estilos["cuerpo"],
        )
    )
    return flujo


def _general(ctx: ContextoDocumento, estilos: dict):
    flujo = []
    flujo.append(Paragraph("1. Descripción", estilos["seccion"]))
    flujo.append(
        Paragraph(f"Contenido del documento {escape(ctx.nombre)}.", estilos["cuerpo"])
    )
    flujo.append(Paragraph("2. Alcance", estilos["seccion"]))
    flujo.append(
        Paragraph("Aplica según lo definido por el área responsable.", estilos["cuerpo"])
    )
    flujo.append(Paragraph("3. Consideraciones generales", estilos["seccion"]))
    flujo.append(
        Paragraph(
            "Cumplir con las disposiciones internas y la normativa aplicable al sector alimentario.",
            estilos["cuerpo"],
        )
    )
    return flujo


def _secciones(tipo: str, ctx: ContextoDocumento, estilos: dict):
    if tipo == TipoDocumento.FICHA_TECNICA.value:
        return _ficha_tecnica(ctx, estilos)
    if tipo == TipoDocumento.MANUAL_BPM.value:
        return _manual(ctx, estilos)
    if tipo == TipoDocumento.PROCEDIMIENTO.value:
        return _procedimiento(ctx, estilos)
    return _general(ctx, estilos)


# --------------------------------------------------------------------------
# Generador principal
# --------------------------------------------------------------------------

def generar_pdf_documento(contexto: ContextoDocumento) -> bytes:
    """Genera el PDF de un documento / versión y devuelve sus bytes."""
    buffer = io.BytesIO()
    estilos = _estilos()
    flujo = []

    flujo.append(Spacer(1, 5 * mm))
    flujo.append(Paragraph(escape(contexto.nombre), estilos["titulo"]))
    flujo.append(Paragraph(f"Ficha documental · {_legible_tipo(contexto.tipo)}", estilos["tipo"]))
    flujo.append(
        HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceBefore=2, spaceAfter=6)
    )

    flujo.append(_tarjeta_info(contexto, estilos))
    flujo.append(Spacer(1, 4 * mm))
    flujo.append(Paragraph(NOTA_DEMO, estilos["demo"]))
    flujo.append(Spacer(1, 5 * mm))

    flujo.extend(_secciones(contexto.tipo, contexto, estilos))

    from reportlab.platypus import SimpleDocTemplate

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGEN,
        rightMargin=MARGEN,
        topMargin=ALTO_BANDA + 10 * mm,
        bottomMargin=20 * mm,
        title=f"SAIA - {contexto.nombre}",
        author="SAIA - Sistema de Apoyo a la Inocuidad Alimentaria",
        subject="Documento de prueba generado por Faker",
    )
    doc.build(
        flujo,
        onFirstPage=_dibujar_marco,
        onLaterPages=_dibujar_marco,
    )
    return buffer.getvalue()


def guardar_pdf_documento(contexto: ContextoDocumento, ruta_salida) -> None:
    """Genera el PDF y lo escribe en `ruta_salida` (str o Path)."""
    from pathlib import Path

    ruta = Path(ruta_salida)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(generar_pdf_documento(contexto))
