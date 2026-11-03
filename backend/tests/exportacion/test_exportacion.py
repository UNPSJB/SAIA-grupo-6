"""Tests de la exportación: filtro `activo` y vistas calculadas (CSV y PDF)."""

import pytest

from src.sector.models import Sector


def _sector(db, nombre, activo):
    db.info["sin_auditoria"] = True
    try:
        db.add(Sector(nombre=nombre, activo=activo))
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def _csv(respuesta) -> str:
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.content.decode("utf-8-sig")


def test_exportar_tabla_filtra_por_activo_false(client_auditoria, db_session):
    _sector(db_session, "Sector vigente", True)
    _sector(db_session, "Sector de baja", False)

    baja = _csv(client_auditoria.get("/exportacion/sectores?formato=csv&activo=false"))
    vigentes = _csv(client_auditoria.get("/exportacion/sectores?formato=csv&activo=true"))

    assert "Sector de baja" in baja and "Sector vigente" not in baja
    assert "Sector vigente" in vigentes and "Sector de baja" not in vigentes


def test_listado_sectores_solo_inactivos(client_auditoria, db_session):
    _sector(db_session, "Sector vigente", True)
    _sector(db_session, "Sector de baja", False)

    resp = client_auditoria.get("/sectores?page=1&solo_inactivos=true")

    assert resp.status_code == 200
    assert [s["nombre"] for s in resp.json()["items"]] == ["Sector de baja"]


@pytest.mark.parametrize(
    "ruta, encabezado",
    [
        ("/exportacion/vistas/vencimientos", "Persona / Equipo"),
        ("/exportacion/vistas/stock-actual", "Stock mínimo"),
        ("/exportacion/vistas/stock-movimientos", "Responsable"),
        ("/exportacion/vistas/stock-lotes", "Cantidad producto"),
        (
            "/exportacion/vistas/stock-consumo?fecha_desde=2026-01-01&fecha_hasta=2026-12-31",
            "Cantidad acumulada",
        ),
    ],
)
def test_vistas_exportan_csv_y_pdf(client_auditoria, ruta, encabezado):
    separador = "&" if "?" in ruta else "?"

    csv = client_auditoria.get(f"{ruta}{separador}formato=csv")
    pdf = client_auditoria.get(f"{ruta}{separador}formato=pdf")

    assert encabezado in _csv(csv)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")
