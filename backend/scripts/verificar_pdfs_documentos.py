"""Verificación de la generación de PDF de prueba para documentos Faker.

Ejecuta sin tocar la base de datos principal: usa directorios temporales y
valida el generador de PDF de forma aislada.

    .venv\\Scripts\\python.exe scripts\\verificar_pdfs_documentos.py
"""

from __future__ import annotations

import base64
import os
import re
import sys
import tempfile
import zlib

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if RAIZ not in sys.path:
    sys.path.insert(0, RAIZ)

from src.documentos.pdf_generator import (  # noqa: E402
    ContextoDocumento,
    generar_pdf_documento,
    guardar_pdf_documento,
)

FALLOS = []


def check(condicion, mensaje):
    estado = "OK" if condicion else "FALLO"
    print(f"[{estado}] {mensaje}")
    if not condicion:
        FALLOS.append(mensaje)


def texto_visible(datos: bytes) -> str:
    """Extrae y descifra el texto de los flujos de contenido del PDF."""
    partes = []
    for m in re.finditer(rb"stream\n(.*?)endstream", datos, flags=re.S):
        blk = m.group(1)
        texto = None
        for decodificar in (
            lambda b: zlib.decompress(base64.a85decode(b, adobe=True)),
            lambda b: zlib.decompress(b),
            lambda b: b,
        ):
            try:
                texto = decodificar(blk).decode("latin-1", errors="replace")
                break
            except Exception:
                continue
        if texto is not None:
            partes.append(texto)
    return "\n".join(partes)


# Ejemplos de distintas categorías con datos temporales (base no modificada).
EJEMPLOS = [
    ContextoDocumento(
        nombre="Ficha tecnica de Balanza de precision",
        tipo="ficha_tecnica",
        numero_version=1,
        identificador="SAIA-DOC-0001",
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="vigente",
        autor="Juan Perez",
        documento_id=1,
    ),
    ContextoDocumento(
        nombre="Manual de Buenas Practicas de Manufactura",
        tipo="manual_bpm",
        numero_version=1,
        identificador="SAIA-DOC-0002",
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="vigente",
        autor="Ana Gomez",
        documento_id=2,
    ),
    ContextoDocumento(
        nombre="Procedimiento de Limpieza y Desinfeccion",
        tipo="procedimiento",
        numero_version=3,
        identificador="SAIA-DOC-0003",
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="vencido",
        autor="Luis Ruiz",
        documento_id=3,
    ),
    ContextoDocumento(
        nombre="Receta de Flan casero",
        tipo="receta",
        numero_version=1,
        identificador=None,
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="vigente",
        autor=None,
        documento_id=4,
    ),
]


def main():
    tmp = tempfile.mkdtemp(prefix="saia_pdf_verif_")
    print(f"Directorio temporal: {tmp}")
    print()

    rutas = []
    nombres_vistos = set()

    for i, ctx in enumerate(EJEMPLOS, 1):
        nombre_archivo = f"doc_{i}_{ctx.documento_id}_v{ctx.numero_version}.pdf"
        ruta = os.path.join(tmp, nombre_archivo)
        guardar_pdf_documento(ctx, ruta)
        rutas.append((ctx, ruta))

        with open(ruta, "rb") as fh:
            datos = fh.read()
        visible = texto_visible(datos)

        check(datos.startswith(b"%PDF"), f"{ctx.nombre}: empieza por %PDF")
        check(b"%%EOF" in datos, f"{ctx.nombre}: trae %%EOF")
        check(b"stream" in datos and b"endstream" in datos,
              f"{ctx.nombre}: contiene flujo de contenido")
        check(len(datos) > 800, f"{ctx.nombre}: tamaño razonable ({len(datos)} bytes)")
        check(b"SAIA" in datos, f"{ctx.nombre}: marca institucional SAIA")
        check(b"/Title" in datos, f"{ctx.nombre}: metadato de título presente")
        check(
            ctx.nombre.encode() in datos,
            f"{ctx.nombre}: nombre asociado al PDF (metadato /Title)",
        )
        check(
            ctx.nombre.encode() in visible.encode("latin-1", errors="ignore"),
            f"{ctx.nombre}: nombre visible en el cuerpo del PDF",
        )
        check(
            ctx.identificador is None or ctx.identificador.encode() in visible.encode("latin-1", errors="ignore"),
            f"{ctx.nombre}: identificador visible cuando corresponde",
        )
        check(
            str(ctx.numero_version).encode() in visible.encode("latin-1", errors="ignore"),
            f"{ctx.nombre}: número de versión {ctx.numero_version} visible",
        )
        if ctx.autor:
            check(
                ctx.autor.encode() in visible.encode("latin-1", errors="ignore"),
                f"{ctx.nombre}: autor visible",
            )
        check(
            "simulados" in visible,
            f"{ctx.nombre}: marca de datos simulados (demo) visible",
        )

        check(
            nombre_archivo not in nombres_vistos,
            f"{ctx.nombre}: nombre de archivo único ({nombre_archivo})",
        )
        nombres_vistos.add(nombre_archivo)

    print()

    # Versiones históricas conservan su propio archivo: mismo documento,
    # dos versiones -> dos archivos distintos, sin sobrescritura.
    ctx_v1 = ContextoDocumento(
        nombre="Procedimiento de Trazabilidad de Lotes",
        tipo="procedimiento",
        numero_version=1,
        identificador="SAIA-DOC-0010",
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="archivado",
        autor="Ana Gomez",
        documento_id=10,
    )
    ctx_v2 = ContextoDocumento(
        nombre="Procedimiento de Trazabilidad de Lotes",
        tipo="procedimiento",
        numero_version=2,
        identificador="SAIA-DOC-0010",
        fecha_emision=None,
        fecha_vencimiento=None,
        estado="vigente",
        autor="Ana Gomez",
        documento_id=10,
    )
    r_v1 = os.path.join(tmp, "doc_hist_v1.pdf")
    r_v2 = os.path.join(tmp, "doc_hist_v2.pdf")
    guardar_pdf_documento(ctx_v1, r_v1)
    guardar_pdf_documento(ctx_v2, r_v2)

    with open(r_v1, "rb") as fh:
        d1 = fh.read()
    with open(r_v2, "rb") as fh:
        d2 = fh.read()

    check(os.path.exists(r_v1) and os.path.exists(r_v2) and r_v1 != r_v2,
          "versiones históricas: dos archivos distintos conservados")
    check(d1 != d2, "versiones históricas: contenido distinto por versión")
    check(d1.startswith(b"%PDF") and b"%%EOF" in d1, "v1: PDF válido y abrible")
    check(d2.startswith(b"%PDF") and b"%%EOF" in d2, "v2: PDF válido y abrible")
    check(
        "Identificador" in texto_visible(d1),
        "v1: tabla de información renderizada",
    )

    print()
    if FALLOS:
        print(f"RESULTADO: {len(FALLOS)} fallo(s)")
        for m in FALLOS:
            print("  -", m)
        sys.exit(1)
    print("RESULTADO: todas las verificaciones pasaron.")


if __name__ == "__main__":
    main()
