"""Configuración de la Pyme y su uso en la cabecera de los PDF."""

from pathlib import Path

from src.config import CARPETA_UPLOADS


def _datos() -> dict:
    return {
        "razon_social": "Dulces del Sur SRL",
        "domicilio": "Av. Siempre Viva 742",
        "telefono": "+54 2901 123456",
        "email": "contacto@dulcesdelsur.com",
        "web": "www.dulcesdelsur.com",
        "rnpa_rppa": "RNPA 123456",
    }


def test_admin_guarda_y_lee_los_datos_de_la_pyme(client, H_ADMIN):
    respuesta = client.put("/pyme", headers=H_ADMIN, json=_datos())

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["razon_social"] == "Dulces del Sur SRL"

    lectura = client.get("/pyme", headers=H_ADMIN)
    assert lectura.status_code == 200
    assert lectura.json()["domicilio"] == "Av. Siempre Viva 742"
    assert lectura.json()["rnpa_rppa"] == "RNPA 123456"


def test_operador_puede_leer_pero_no_editar(client, usuarios):
    assert client.get("/pyme", headers=usuarios["operador"]).status_code == 200

    edicion = client.put(
        "/pyme",
        headers=usuarios["operador"],
        json={"razon_social": "No permitido"},
    )
    assert edicion.status_code == 403


def test_sin_sesion_no_se_puede_leer(client):
    assert client.get("/pyme").status_code == 401


def test_logo_opcional_y_los_pdf_siguen_saliendo(client, H_ADMIN):
    # Un "png" que no es una imagen válida: el PDF no puede romperse por eso.
    respuesta = client.post(
        "/pyme/logo",
        headers=H_ADMIN,
        files={"archivo": ("logo.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")},
    )
    assert respuesta.status_code == 200, respuesta.text
    ruta = respuesta.json()["logo_url"]
    assert ruta and ruta.startswith("uploads/pyme/")

    try:
        pdf = client.get("/exportacion/sectores?formato=pdf", headers=H_ADMIN)
        assert pdf.status_code == 200, pdf.text
        assert pdf.content.startswith(b"%PDF")
    finally:
        archivo = CARPETA_UPLOADS / Path(ruta).relative_to("uploads")
        archivo.unlink(missing_ok=True)


def test_pdf_de_listado_lleva_cabecera_de_la_pyme(client, H_ADMIN):
    client.put("/pyme", headers=H_ADMIN, json=_datos())

    pdf = client.get("/exportacion/vistas/lotes-produccion?formato=pdf", headers=H_ADMIN)

    assert pdf.status_code == 200, pdf.text
    assert pdf.content.startswith(b"%PDF")
    # Con muchas filas hay varias páginas: el pie numera "Página X de Y".
    assert b"/Type /Page" in pdf.content
