"""Cabecera de identidad de la Pyme para los PDF del sistema.

Centraliza lo que comparten todos los reportes: logo, razón social, datos de
contacto, título del reporte, fecha de emisión, usuario que lo generó y la
numeración "Página X de Y".

Los PDF de listados (`src.exportacion`) y los de E11/E13 (nutrición y rótulo)
arman su cabecera con `flowables_cabecera` y usan `fabrica_lienzo` como
`canvasmaker` para escribir el pie con el total de páginas.

El logo es opcional: si no está cargado (o el archivo ya no existe) los
documentos se generan igual, sin logo.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as lienzo
from reportlab.platypus import (
    Flowable,
    HRFlowable,
    Image,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from src.config import CARPETA_UPLOADS
from src.pyme.models import ConfiguracionPyme

_TINTA = colors.HexColor("#1f2937")
_TENUE = colors.HexColor("#6b7280")
_MARCA = colors.HexColor("#0f6b6b")
_BORDE = colors.HexColor("#d1d5db")

_ALTO_LOGO_MAXIMO = 18 * mm
_ANCHO_LOGO_MAXIMO = 42 * mm


@dataclass(frozen=True)
class CabeceraPyme:
    """Datos ya resueltos (sin base de datos) que encabezan un PDF."""

    razon_social: Optional[str] = None
    domicilio: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    web: Optional[str] = None
    rnpa_rppa: Optional[str] = None
    logo: Optional[Path] = None

    @property
    def nombre(self) -> str:
        return self.razon_social or "SAIA"

    def lineas_contacto(self) -> list[str]:
        datos = [
            self.domicilio,
            self.telefono,
            self.email,
            self.web,
            f"RNPA/RPPA: {self.rnpa_rppa}" if self.rnpa_rppa else None,
        ]
        return [dato.strip() for dato in datos if dato and dato.strip()]


def _texto(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    limpio = valor.strip()
    return limpio or None


def _ruta_logo(logo_url: Optional[str]) -> Optional[Path]:
    """Convierte `uploads/...` en una ruta absoluta dentro de la carpeta de subidas."""
    if not logo_url:
        return None
    relativa = logo_url[len("uploads/") :] if logo_url.startswith("uploads/") else logo_url
    try:
        ruta = (CARPETA_UPLOADS / relativa).resolve()
        ruta.relative_to(CARPETA_UPLOADS.resolve())
    except (ValueError, OSError):
        return None
    return ruta if ruta.is_file() else None


def cabecera_desde(configuracion: Optional[ConfiguracionPyme]) -> CabeceraPyme:
    if configuracion is None:
        return CabeceraPyme()
    return CabeceraPyme(
        razon_social=_texto(configuracion.razon_social),
        domicilio=_texto(configuracion.domicilio),
        telefono=_texto(configuracion.telefono),
        email=_texto(configuracion.email),
        web=_texto(configuracion.web),
        rnpa_rppa=_texto(configuracion.rnpa_rppa),
        logo=_ruta_logo(configuracion.logo_url),
    )


def cabecera_desde_db(db) -> CabeceraPyme:
    from src.pyme import services

    return cabecera_desde(services.obtener_configuracion(db))


def nombre_usuario(usuario) -> Optional[str]:
    """Acepta un `Personal`, un nombre ya armado o `None`."""
    if usuario is None:
        return None
    if isinstance(usuario, str):
        return _texto(usuario)
    nombre = " ".join(
        parte
        for parte in (
            getattr(usuario, "nombre", None),
            getattr(usuario, "apellido", None),
        )
        if parte
    ).strip()
    return nombre or _texto(getattr(usuario, "email", None))


def _estilos() -> dict[str, ParagraphStyle]:
    return {
        "nombre": ParagraphStyle(
            "pyme_nombre",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=_TINTA,
        ),
        "contacto": ParagraphStyle(
            "pyme_contacto",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=_TENUE,
        ),
        "titulo": ParagraphStyle(
            "pyme_titulo",
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=_MARCA,
        ),
        "meta": ParagraphStyle(
            "pyme_meta",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=_TENUE,
        ),
    }


def _imagen_logo(ruta: Optional[Path]) -> Optional[Image]:
    if ruta is None:
        return None
    try:
        imagen = Image(str(ruta))
        factor = min(
            _ALTO_LOGO_MAXIMO / imagen.imageHeight,
            _ANCHO_LOGO_MAXIMO / imagen.imageWidth,
            1,
        )
        imagen.drawWidth = imagen.imageWidth * factor
        imagen.drawHeight = imagen.imageHeight * factor
        return imagen
    except Exception:
        # Un logo ilegible no puede impedir que se genere el reporte.
        return None


def flowables_cabecera(
    cabecera: CabeceraPyme,
    titulo: str,
    usuario=None,
    generado: Optional[datetime] = None,
    ancho_util: Optional[float] = None,
) -> list[Flowable]:
    """Bloques de la cabecera, listos para encabezar el `doc.build`."""
    generado = generado or datetime.now()
    estilos = _estilos()

    texto: list[Flowable] = [Paragraph(escape(cabecera.nombre), estilos["nombre"])]
    contacto = " · ".join(cabecera.lineas_contacto())
    if contacto:
        texto.append(Paragraph(escape(contacto), estilos["contacto"]))
    texto.append(Spacer(1, 3 * mm))
    texto.append(Paragraph(escape(titulo), estilos["titulo"]))

    emitido = f"Emitido el {generado:%d/%m/%Y %H:%M}"
    quien = nombre_usuario(usuario)
    if quien:
        emitido += f" · Generado por: {quien}"
    texto.append(Paragraph(escape(emitido), estilos["meta"]))

    bloques: list[Flowable] = []
    logo = _imagen_logo(cabecera.logo)
    if logo is not None:
        ancho_logo = max(logo.drawWidth, _ANCHO_LOGO_MAXIMO)
        segunda = ancho_util - ancho_logo - 4 * mm if ancho_util else None
        tabla = Table(
            [[logo, texto]],
            colWidths=[ancho_logo + 4 * mm, segunda] if segunda else [ancho_logo + 4 * mm, None],
        )
        tabla.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        bloques.append(tabla)
    else:
        bloques.extend(texto)

    bloques.append(Spacer(1, 3 * mm))
    bloques.append(HRFlowable(width="100%", thickness=1, color=_BORDE))
    bloques.append(Spacer(1, 3 * mm))
    return bloques


class LienzoNumerado(lienzo.Canvas):
    """Canvas de dos pasadas: recién al final sabe cuántas páginas hay."""

    def __init__(self, *args, cabecera: Optional[CabeceraPyme] = None, pie_completo: bool = True, **kwargs):
        super().__init__(*args, **kwargs)
        self._cabecera_pyme = cabecera
        self._pie_completo = pie_completo
        self._estados_pagina: list[dict] = []

    def showPage(self):  # noqa: N802 (API de reportlab)
        self._estados_pagina.append(dict(self.__dict__))
        self._startPage()

    def save(self):  # noqa: N802 (API de reportlab)
        total = len(self._estados_pagina)
        for estado in self._estados_pagina:
            self.__dict__.update(estado)
            self._dibujar_pie(total)
            super().showPage()
        super().save()

    def _dibujar_pie(self, total: int) -> None:
        ancho, _alto = self._pagesize
        margen = 10 * mm
        y_pie = 8 * mm if self._pie_completo else 8.5 * mm
        self.saveState()
        if self._pie_completo:
            self.setStrokeColor(_BORDE)
            self.setLineWidth(0.5)
            self.line(margen, 12 * mm, ancho - margen, 12 * mm)
            self.setFillColor(_TENUE)
            self.setFont("Helvetica", 7.5)
            izquierda = self._cabecera_pyme.nombre if self._cabecera_pyme else "SAIA"
            if self._cabecera_pyme:
                contacto = " · ".join(self._cabecera_pyme.lineas_contacto())
                if contacto:
                    izquierda = f"{izquierda} · {contacto}"
            self.drawString(margen, y_pie, izquierda[:200])
        self.setFillColor(_TENUE)
        self.setFont("Helvetica", 7.5)
        self.drawRightString(
            ancho - margen, y_pie, f"Página {self._pageNumber} de {total}"
        )
        self.restoreState()


def fabrica_lienzo(cabecera: Optional[CabeceraPyme], pie_completo: bool = True):
    """Devuelve un `canvasmaker` para `doc.build(..., canvasmaker=...)`."""

    def _crear(*args, **kwargs):
        return LienzoNumerado(
            *args, cabecera=cabecera, pie_completo=pie_completo, **kwargs
        )

    return _crear
