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
        ("/exportacion/vistas/lotes-produccion", "Número de lote"),
        ("/exportacion/vistas/salidas", "Fecha de reserva"),
        ("/exportacion/vistas/retiros", "Notificados"),
        ("/exportacion/vistas/recetas", "Versión vigente"),
        ("/exportacion/vistas/productos", "Descripción"),
        ("/exportacion/vistas/alimentos", "Energía (kcal)"),
        ("/exportacion/vistas/rotulado", "Borradores"),
    ],
)
def test_vistas_exportan_csv_y_pdf(client_auditoria, ruta, encabezado):
    separador = "&" if "?" in ruta else "?"

    csv = client_auditoria.get(f"{ruta}{separador}formato=csv")
    pdf = client_auditoria.get(f"{ruta}{separador}formato=pdf")

    assert encabezado in _csv(csv)
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")


def _producto(db, nombre, activo=True):
    from src.productos.models import Producto
    from src.unidadMedida.models import UnidadMedida

    db.info["sin_auditoria"] = True
    try:
        unidad = db.query(UnidadMedida).filter_by(simbolo="kg").first()
        if unidad is None:
            unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg")
            db.add(unidad)
            db.flush()
        db.add(Producto(nombre=nombre, unidad_medida_id=unidad.id, activo=activo))
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)


def test_vista_productos_respeta_busqueda_y_bajas(client_auditoria, db_session):
    _producto(db_session, "Budín de vainilla")
    _producto(db_session, "Pan de molde")
    _producto(db_session, "Mermelada vieja", activo=False)

    buscados = _csv(client_auditoria.get("/exportacion/vistas/productos?formato=csv&buscar=bud"))
    bajas = _csv(client_auditoria.get("/exportacion/vistas/productos?formato=csv&incluir_inactivos=true"))
    rotulado = _csv(client_auditoria.get("/exportacion/vistas/rotulado?formato=csv"))

    assert "Budín de vainilla" in buscados and "Pan de molde" not in buscados
    assert "Mermelada vieja" in bajas and "Pan de molde" not in bajas
    assert "Pan de molde" in rotulado and "Mermelada vieja" not in rotulado


def test_numero_en_formato_argentino():
    from src.exportacion.vistas import _cantidad, _numero

    assert _numero("1632.851") == "1.632,851"
    assert _numero("4.000") == "4"
    assert _cantidad("16.5", "kg") == "16,5 kg"
    assert _numero(None) == "-"
