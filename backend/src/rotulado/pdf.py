from datetime import datetime
from io import BytesIO
from math import cos, pi, sin
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Flowable, LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, TableStyle


# Paleta clara de SAIA (frontend/src/theme/index.ts).
_TINTA = colors.HexColor("#1E293B")
_SECUNDARIO = colors.HexColor("#475569")
_MARCA_OSCURA = colors.HexColor("#26454B")
_MARCA = colors.HexColor("#37666D")
_ACENTO = colors.HexColor("#90BEBB")
_BORDE = colors.HexColor("#BBDFDC")
_FONDO = colors.HexColor("#EEF6F5")
_AVISO_FONDO = colors.HexColor("#FBF1DC")
_AVISO_TEXTO = colors.HexColor("#8A5A12")


_OCTOGONOS = {
    "azucares": ("AZÚCARES",),
    "grasas_totales": ("GRASAS", "TOTALES"),
    "grasas_saturadas": ("GRASAS", "SATURADAS"),
    "sodio": ("SODIO",),
    "calorias": ("CALORÍAS",),
}


class Octogonos(Flowable):
    def __init__(self, claves):
        super().__init__()
        self.claves = claves
        self.width = len(claves) * 24 * mm
        self.height = 23 * mm

    def draw(self):
        canvas = self.canv
        for indice, clave in enumerate(self.claves):
            centro_x, centro_y = (indice * 24 + 11) * mm, 11 * mm
            for radio, color in ((11, colors.black), (10.5, colors.white), (9.8, colors.black)):
                poligono = canvas.beginPath()
                for i in range(8):
                    angulo = (i + 0.5) * pi / 4
                    x = centro_x + radio * mm * cos(angulo)
                    y = centro_y + radio * mm * sin(angulo)
                    (poligono.moveTo if i == 0 else poligono.lineTo)(x, y)
                poligono.close()
                canvas.setFillColor(color)
                canvas.drawPath(poligono, fill=1, stroke=0)
            canvas.setFillColor(colors.white)
            canvas.setFont("Helvetica-Bold", 7)
            canvas.drawCentredString(centro_x, centro_y + 10, "EXCESO EN")
            for i, linea in enumerate(_OCTOGONOS[clave]):
                canvas.drawCentredString(centro_x, centro_y + 1 - 8 * i, linea)
            canvas.setFont("Helvetica", 4.5)
            canvas.drawCentredString(centro_x, centro_y - 15, "Ministerio de Salud")


def generar_pdf(vista, receta, composicion, nutricion_actual, fuentes, coincide, generado: datetime) -> bytes:
    salida = BytesIO()
    borrador = vista.borrador
    frontal = vista.rotulado_frontal
    doc = SimpleDocTemplate(
        salida, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=24 * mm, bottomMargin=17 * mm, title=f"Borrador de rótulo #{borrador.id}",
        author="SAIA",
    )
    estilos = getSampleStyleSheet()
    estilos["Normal"].textColor = _TINTA
    estilos["BodyText"].textColor = _TINTA
    estilos["Title"].alignment = TA_LEFT
    estilos["Title"].textColor = _MARCA_OSCURA
    estilos["Title"].fontSize = 24
    estilos["Title"].leading = 28
    estilos["Heading1"].textColor = _MARCA_OSCURA
    estilos["Heading2"].textColor = _MARCA_OSCURA
    estilos["Heading2"].backColor = _FONDO
    estilos["Heading2"].borderPadding = (4, 7, 4, 7)
    estilos["Heading3"].textColor = _MARCA
    estilos.add(ParagraphStyle(
        "Celda", fontName="Helvetica", fontSize=8, leading=10, textColor=_TINTA,
    ))
    estilos.add(ParagraphStyle(
        "Cabecera", parent=estilos["Celda"], fontName="Helvetica-Bold", textColor=colors.white,
    ))
    estilos.add(ParagraphStyle(
        "Aviso", parent=estilos["BodyText"], backColor=_AVISO_FONDO,
        textColor=_AVISO_TEXTO, borderPadding=(4, 7, 4, 7), fontName="Helvetica-Bold",
    ))
    estilos.add(ParagraphStyle("Metadatos", parent=estilos["BodyText"], textColor=_SECUNDARIO, fontSize=9))
    bloques = []

    def parrafo(valor, estilo="BodyText"):
        texto = "—" if valor is None or valor == "" else str(valor)
        return Paragraph(escape(texto).replace("\n", "<br/>"), estilos[estilo])

    def agregar(valor, estilo="BodyText"):
        bloques.append(parrafo(valor, estilo))

    def tabla(cabeceras, filas, anchos):
        if not filas:
            agregar("Sin datos disponibles.")
            return
        grilla = LongTable(
            [[parrafo(c, "Cabecera") for c in cabeceras]]
            + [[parrafo(v, "Celda") for v in fila] for fila in filas],
            colWidths=[doc.width * a for a in anchos], repeatRows=1, splitInRow=1, hAlign="LEFT",
        )
        grilla.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), _MARCA),
            ("LINEBELOW", (0, 0), (-1, 0), 1.25, _ACENTO),
            ("LINEBELOW", (0, -1), (-1, -1), 0.5, _BORDE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _FONDO]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        bloques.append(grilla)

    def tabla_nutricional(datos, unidad=None):
        agregar(f"Porción: {unidad or '—'}")
        tabla(
            ["Nutriente", f"Por 100 {datos.expresar_en or ''}", "Por porción", "% VD"],
            [(f"{f.nombre} ({f.unidad})", f.por_100_texto or f.por_100, f.por_porcion_texto or f.por_porcion,
              f.vd_texto or f.vd) for f in datos.filas],
            [.39, .25, .24, .12],
        )
        for problema in datos.problemas:
            agregar(problema)

    def marco_pagina(canvas, documento):
        ancho, alto = A4
        margen = 16 * mm
        canvas.saveState()
        canvas.setFillColor(_MARCA_OSCURA)
        canvas.rect(0, alto - 17 * mm, ancho, 17 * mm, fill=1, stroke=0)
        canvas.setFillColor(_ACENTO)
        canvas.rect(0, alto - 18 * mm, ancho, mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 15)
        canvas.drawString(margen, alto - 11 * mm, "SAIA")
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(ancho - margen, alto - 11 * mm, "Rotulado de productos")

        canvas.setStrokeColor(_BORDE)
        canvas.line(margen, 13 * mm, ancho - margen, 13 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(_SECUNDARIO)
        canvas.drawString(margen, 8.5 * mm, f"Borrador para revisión · #{borrador.id} · Receta v{receta.numero}")
        canvas.drawRightString(ancho - margen, 8.5 * mm, f"Página {documento.page}")
        canvas.restoreState()

    agregar("Borrador para revisión", "Aviso")
    bloques.append(Spacer(1, 3 * mm))
    agregar(borrador.denominacion_venta or borrador.producto_nombre, "Title")
    agregar(f"Generado: {generado.isoformat(timespec='seconds')} · Receta v{receta.numero} (ID {receta.id})", "Metadatos")
    agregar(f"Contenido neto: {borrador.contenido_neto or 'Pendiente'}")
    if frontal.estado == "aplica" and frontal.sellos:
        positivos = [s.clave for s in frontal.sellos.resultados if s.evaluado and s.exceso is True]
        claves = [clave for clave in positivos if clave in _OCTOGONOS]
        if claves:
            bloques.append(Octogonos(claves))
        for sello in frontal.sellos.resultados:
            if sello.clave in positivos and sello.clave not in _OCTOGONOS:
                agregar(sello.etiqueta)
    agregar("Datos del rótulo", "Heading2")
    for etiqueta, valor in (
        ("Ingredientes", borrador.lista_ingredientes),
        ("Razón social", borrador.razon_social), ("Domicilio", borrador.domicilio),
        ("RNPA/RPPA", borrador.rnpa_rppa), ("Lote", borrador.identificacion_lote),
        ("Fecha de producción", borrador.fecha_produccion), ("Fecha de cierre", borrador.fecha_cierre),
        ("Fecha de duración", borrador.fecha_duracion), ("Instrucciones de uso", borrador.instrucciones_uso),
    ):
        agregar(f"{etiqueta}: {valor if valor is not None and valor != '' else '—'}")
    if borrador.es_importado:
        agregar(f"Importador: {borrador.importador_razon_social or '—'}")
        agregar(f"Domicilio del importador: {borrador.importador_domicilio or '—'}")
    if vista.declaraciones:
        agregar("Alérgenos, gluten y conservación", "Heading2")
        for texto in (vista.declaraciones.declaracion, vista.declaraciones.declaracion_cruzada):
            if texto:
                agregar(texto)
        contenido = vista.declaraciones.contenido or {}
        if contenido.get("gluten"):
            gluten = {
                "presente": "Presencia declarada",
                "sin_presencia_declarada": "Sin presencia declarada en los insumos evaluados",
            }.get(contenido["gluten"], "Información insuficiente")
            agregar(f"Gluten: {gluten}")
        conservacion = contenido.get("conservacion") or {}
        for prefijo, condicion in (("Conservación", conservacion), ("Después de abrir", conservacion.get("despues_abrir"))):
            if not condicion:
                continue
            if condicion.get("instrucciones"):
                agregar(f"{prefijo}: {condicion['instrucciones']}")
            if condicion.get("temperatura_aplicable"):
                agregar(f"Temperatura: {condicion.get('temperatura_minima')} a {condicion.get('temperatura_maxima')} °C")
            if condicion.get("duracion_aplicable"):
                agregar(f"Duración: {condicion.get('duracion')} {condicion.get('unidad_duracion') or ''}")
    agregar("Tabla nutricional guardada", "Heading2")
    guardada = vista.nutricion.tabla
    if guardada:
        tabla_nutricional(guardada, f"{guardada.porcion or '—'} {guardada.expresar_en or ''} · {guardada.medida_casera or '—'}")
    else:
        agregar(vista.nutricion.problemas[0] if vista.nutricion.problemas else "Tabla guardada no disponible.")
    bloques.append(PageBreak())

    agregar("Anexo de cálculo", "Title")
    agregar(f"Receta v{receta.numero} (ID {receta.id}) · Rendimiento: {receta.rendimiento} {receta.unidad_medida.simbolo}")
    if vista.origen.motivo:
        agregar(vista.origen.motivo)
    agregar("Receta y composición porcentual", "Heading2")
    porcentajes = {i.insumo.id: i.porcentaje for i in composicion.ingredientes + composicion.aditivos}
    tabla(
        ["Insumo", "Clasificación", "Cantidad", "Composición (%)"],
        [(r.insumo.nombre, r.clasificacion, f"{r.cantidad} {r.unidad_medida.simbolo}",
          porcentajes.get(r.insumo_id)) for r in receta.insumos],
        [.39, .20, .21, .20],
    )
    for dato in composicion.faltantes:
        agregar(f"{dato.insumo.nombre}: {dato.motivo}")

    agregar("Tabla nutricional del cálculo actual y fuentes", "Heading2")
    if guardada:
        agregar("Los valores guardados coinciden con el cálculo actual." if coincide else
                "La tabla guardada difiere del cálculo actual. Las fuentes siguientes corresponden al cálculo actual.")
        agregar("La instantánea guardada no incluye un historial de fuentes.")
    config = nutricion_actual.configuracion
    tabla_nutricional(nutricion_actual, f"{config.porcion or '—'} {nutricion_actual.expresar_en} · {config.medida_casera or '—'}")
    agregar(nutricion_actual.leyenda_calculo)
    if nutricion_actual.cantidad_base is not None:
        agregar(f"Cantidad base: {nutricion_actual.cantidad_base} {nutricion_actual.expresar_en}")
    for ingrediente in nutricion_actual.incompletos:
        agregar(f"{ingrediente.nombre}: {', '.join(ingrediente.faltantes) or 'Datos incompletos'}")
    agregar("Aportes por ingrediente", "Heading3")
    tabla(
        ["Insumo y nutriente", "Peso (g)", "Dato por 100 g", "Aporte", "Fuente y referencia"],
        [(f"{f.insumo} · {f.nutriente}" + (f" (a partir de {f.nutriente_fuente})" if f.nutriente_fuente != f.nutriente else ""),
          f"{f.gramos:.3f}", f"{f.valor_por_100_g:.4g}", f"{f.aporte:.5g}",
          f"{f.fuente} · {f.referencia or 'Sin referencia'} · Valor fuente: {f.valor_fuente}") for f in fuentes],
        [.31, .11, .14, .12, .32],
    )
    if nutricion_actual.laboratorio:
        agregar("Análisis de laboratorio", "Heading3")
        tabla(
            ["Nutriente", "Valor por 100", "Referencia", "Fecha del análisis"],
            [(l.nombre, f"{l.valor_100} {l.unidad}", l.referencia, l.fecha_analisis) for l in nutricion_actual.laboratorio],
            [.29, .21, .30, .20],
        )

    agregar("Cálculo de sellos", "Heading2")
    agregar(frontal.mensaje)
    for aviso in dict.fromkeys(frontal.faltantes + frontal.advertencias):
        agregar(aviso)
    if frontal.regla_version is not None:
        agregar(f"Versión de parámetros E12: {frontal.regla_version}")
    if frontal.sellos:
        sellos = frontal.sellos
        agregar(f"Vigencia desde: {sellos.vigencia_desde} · Norma de origen: {sellos.norma_origen}")
        if sellos.motivo:
            agregar(sellos.motivo)
        tabla(
            ["Sello", "Valor calculado", "Umbral", "Resultado"],
            [(s.etiqueta, f"{s.valor_calculado} {s.unidad_calculado}" if s.valor_calculado is not None else "—",
              f"{s.umbral} {s.unidad_umbral}" if s.umbral is not None else "—",
              "Exceso" if s.evaluado and s.exceso else "Sin exceso" if s.evaluado else s.motivo or "Pendiente")
             for s in sellos.resultados],
            [.28, .19, .19, .34],
        )
        for sello in sellos.resultados:
            if sello.formula or sello.pasos:
                agregar(sello.etiqueta, "Heading3")
                if sello.formula:
                    agregar(f"Fórmula: {sello.formula}")
                for paso in sello.pasos:
                    valor = f": {paso.valor} {paso.unidad}" if paso.valor is not None else ""
                    agregar(paso.descripcion + valor)
    doc.build(bloques, onFirstPage=marco_pagina, onLaterPages=marco_pagina)
    return salida.getvalue()
