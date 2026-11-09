"""PDF de la tabla de información nutricional.

Siempre lleva la leyenda de "valores calculados, revisar por un/a profesional"
y, si la tabla está incompleta, la advertencia: no hay forma de exportarla sin
ellas.
"""

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from src.nutricion import calculo, schemas
from src.nutricion.constants import ESTADO_INCOMPLETA

_TEXTO = colors.HexColor("#1F2937")
_TENUE = colors.HexColor("#5B6B6B")
_PRIMARIO = colors.HexColor("#0F6B6B")
_ALERTA_FONDO = colors.HexColor("#FDECEC")
_ALERTA = colors.HexColor("#B42318")
_AVISO_FONDO = colors.HexColor("#FFF7E6")
_AVISO = colors.HexColor("#8A5A00")

_titulo = ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=_PRIMARIO, spaceAfter=2)
_sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=9, textColor=_TENUE, spaceAfter=8)
_celda = ParagraphStyle("celda", fontName="Helvetica", fontSize=9, textColor=_TEXTO, leading=11)
_celda_b = ParagraphStyle("celda_b", parent=_celda, fontName="Helvetica-Bold")
_num = ParagraphStyle("num", parent=_celda, alignment=TA_RIGHT)
_num_b = ParagraphStyle("num_b", parent=_celda_b, alignment=TA_RIGHT)
_encabezado = ParagraphStyle("encabezado", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=colors.black)
_nota = ParagraphStyle("nota", fontName="Helvetica", fontSize=8, textColor=_TEXTO, leading=10, spaceAfter=3)
_alerta = ParagraphStyle("alerta", fontName="Helvetica-Bold", fontSize=9, textColor=_ALERTA, leading=12)
_aviso = ParagraphStyle("aviso", fontName="Helvetica-Bold", fontSize=9, textColor=_AVISO, leading=12)


def _caja(parrafos: list[Paragraph], fondo, borde) -> Table:
    tabla = Table([[p] for p in parrafos], colWidths=[170 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fondo),
                ("BOX", (0, 0), (-1, -1), 1, borde),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tabla


def generar_pdf(info: schemas.InfoNutricionalResponse) -> bytes:
    salida = io.BytesIO()
    doc = SimpleDocTemplate(
        salida,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Información nutricional - {info.producto}",
    )
    cfg = info.configuracion
    unidad_base = info.expresar_en
    elementos = [
        Paragraph("Información nutricional", _titulo),
        Paragraph(
            escape(
                f"{info.producto}"
                + (f" · receta versión {info.version.numero}" if info.version else "")
                + f" · generado el {info.calculado_en:%d/%m/%Y %H:%M}"
            ),
            _sub,
        ),
        _caja([Paragraph(escape(info.leyenda_calculo), _aviso)], _AVISO_FONDO, _AVISO),
        Spacer(1, 6 * mm),
    ]

    if info.estado == ESTADO_INCOMPLETA or info.problemas or info.incompletos:
        lineas = [Paragraph("TABLA INCOMPLETA: los valores se calcularon con datos faltantes.", _alerta)]
        for ing in info.incompletos:
            lineas.append(
                Paragraph(escape(f"• {ing.nombre}: falta {', '.join(ing.faltantes)}"), _celda)
            )
        for problema in info.problemas:
            lineas.append(Paragraph(escape(f"• {problema}"), _celda))
        elementos += [_caja(lineas, _ALERTA_FONDO, _ALERTA), Spacer(1, 6 * mm)]

    porcion = (
        f"Porción {calculo.texto_numero(cfg.porcion, 0 if cfg.porcion == cfg.porcion.to_integral() else 1)} {unidad_base}"
        if cfg.porcion
        else "Porción sin declarar"
    )
    if cfg.medida_casera:
        porcion += f" ({cfg.medida_casera})"

    con_100 = info.mostrar_por_100
    columnas = 4 if con_100 else 3
    vacias = [""] * (columnas - 1)
    filas = [
        [Paragraph("INFORMACIÓN NUTRICIONAL", _encabezado), *vacias],
        [Paragraph(escape(porcion), _celda), *vacias],
        [
            "",
            *([Paragraph(f"Por 100 {unidad_base}", _num_b)] if con_100 else []),
            Paragraph("Cantidad por porción", _num_b),
            Paragraph("% VD (*)", _num_b),
        ],
    ]
    subnutrientes = ("azucares_totales", "azucares_anadidos", "grasas_saturadas", "grasas_trans")
    for fila in info.filas:
        unidad = "" if fila.clave == "energia" else f" {fila.unidad}"
        sub = fila.clave in subnutrientes
        nombre = ("&nbsp;&nbsp;&nbsp;&nbsp;" if sub else "") + escape(fila.nombre)
        if fila.faltan_datos:
            nombre += ' <font size="7" color="#B42318">faltan datos</font>'
        marca = "**" if fila.de_laboratorio else ""

        def valor(texto: str) -> Paragraph:
            return Paragraph(escape(texto + (unidad + marca if texto != "—" else "")), _num)

        filas.append(
            [
                Paragraph(nombre, _celda if sub else _celda_b),
                *([valor(fila.por_100_texto)] if con_100 else []),
                valor(fila.por_porcion_texto),
                Paragraph(escape(fila.vd_texto), _num_b),
            ]
        )
    anchos = [62 * mm, 38 * mm, 38 * mm, 32 * mm] if con_100 else [80 * mm, 55 * mm, 35 * mm]
    tabla = Table(filas, colWidths=anchos)
    tabla.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (-1, 0)),
                ("SPAN", (0, 1), (-1, 1)),
                ("BOX", (0, 0), (-1, -1), 1.5, colors.black),
                # Como en los rótulos: barra gruesa bajo la porción y bajo la energía.
                ("LINEBELOW", (0, 1), (-1, 1), 4, colors.black),
                ("LINEBELOW", (0, 2), (-1, 2), 0.5, colors.grey),
                ("LINEBELOW", (0, 3), (-1, 3), 2, colors.black),
                ("LINEBELOW", (0, 4), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elementos += [tabla, Spacer(1, 3 * mm)]

    if info.leyenda_no_significativo:
        elementos.append(Paragraph(escape(info.leyenda_no_significativo), _nota))
    if info.leyenda_vd:
        elementos.append(Paragraph(escape(info.leyenda_vd), _nota))
    if any(f.de_laboratorio for f in info.filas):
        elementos.append(Paragraph(escape(info.leyenda_laboratorio), _nota))

    elementos += [
        Spacer(1, 6 * mm),
        _caja([Paragraph(escape(info.leyenda_calculo), _aviso)], _AVISO_FONDO, _AVISO),
    ]
    doc.build(elementos)
    return salida.getvalue()
