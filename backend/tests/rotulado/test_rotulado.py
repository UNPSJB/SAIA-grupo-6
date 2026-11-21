from unittest.mock import Mock
from types import SimpleNamespace
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import event, select
from datetime import date
from decimal import Decimal

from src.auth.dependencies import require_admin
from src.database import get_db
from src.insumos.models import Insumo
from src.productos.models import Producto
from src.recetas.models import Receta, VersionReceta, RecetaInsumo
from src.rotulado import services, schemas, exceptions
from src.rotulado.router import router
from src.unidadMedida.models import UnidadMedida
from src.nutricion.models import ParametroNutriente


@pytest.fixture
def datos(db_session):
    db = db_session
    db.info["sin_auditoria"] = True
    unidad = UnidadMedida(nombre="Gramo", simbolo="g", tipo="masa", factor_a_base=1)
    producto = Producto(nombre="Mermelada de frutilla", unidad_medida=unidad)
    insumo = Insumo(nombre="Frutilla", unidad_medida=unidad)
    receta = Receta(producto=producto)
    version = VersionReceta(receta=receta, numero=1, rendimiento=100, unidad_medida=unidad)
    version.insumos = [RecetaInsumo(insumo=insumo, cantidad=100, unidad_medida=unidad, clasificacion="ingrediente")]
    db.add_all([producto, receta, version])
    db.commit()
    return db, producto, receta, version


def test_preview_http_no_escribe_ni_commit(datos, monkeypatch):
    db, producto, _, version = datos
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_admin] = lambda: None
    db.commit = Mock(side_effect=AssertionError("GET no debe hacer commit"))
    sentencias = []
    def registrar(conn, cursor, statement, parameters, context, executemany):
        sentencias.append(statement.strip().split()[0].upper())
    event.listen(db.bind, "before_cursor_execute", registrar)
    try:
        response = TestClient(app).get(f"/rotulado/productos/{producto.id}/autocompletar/preview")
        assert response.status_code == 200, response.text
        vista = response.json()
        assert vista["denominacion_venta"] == producto.nombre
        assert vista["lista_ingredientes"] == "Frutilla"
        assert vista["version_receta_id"] == version.id
        assert vista["datos_nutricionales_json"] is not None
        assert not {"INSERT", "UPDATE", "DELETE", "REPLACE", "CREATE"}.intersection(sentencias)
        db.commit.assert_not_called()
        assert db.scalar(select(ParametroNutriente)) is None
    finally:
        event.remove(db.bind, "before_cursor_execute", registrar)


def test_sin_receta_conserva_denominacion(datos):
    db, producto, _, _ = datos
    otro = Producto(nombre="Sin receta", unidad_medida_id=producto.unidad_medida_id)
    db.add(otro)
    db.commit()
    vista = services.preview_autocompletado(db, otro.id)
    assert vista.denominacion_venta == otro.nombre
    assert not vista.receta_encontrada


def test_version_vigente_y_version_explicita(datos):
    db, producto, receta, anterior = datos
    nueva = VersionReceta(receta_id=receta.id, numero=2, rendimiento=100, unidad_medida_id=producto.unidad_medida_id)
    db.add(nueva)
    db.commit()
    assert services.preview_autocompletado(db, producto.id).version_receta_id == nueva.id
    assert services.preview_autocompletado(db, producto.id, anterior.id).version_receta_id == anterior.id


def test_version_ajena_rechazada(datos):
    db, producto, _, version = datos
    otro = Producto(nombre="Otro", unidad_medida_id=producto.unidad_medida_id)
    receta = Receta(producto=otro)
    db.add(receta)
    db.commit()
    with pytest.raises(exceptions.VersionNoPerteneceAlProducto):
        services.preview_autocompletado(db, otro.id, version.id)


def test_guardar_fechas_y_autocompletar_preserva_manual(datos):
    db, producto, _, version = datos
    borrador = services.crear_borrador(db, producto.id, schemas.BorradorRotuladoCreate(producto_id=producto.id, version_receta_id=version.id, denominacion_venta="Manual"))
    resultado = services.autocompletar_borrador(db, borrador.id, None, None, False)
    assert resultado.denominacion_venta == "Manual"
    assert "Frutilla" in resultado.lista_ingredientes
    salida = schemas.BorradorRotuladoOut.model_validate(resultado)
    assert salida.creado_en is not None
    assert services.calcular_completitud(db, borrador.id).campos[0].estado == "completo"


def test_autocompletar_fecha_duracion_desde_lote(datos):
    """Al autocompletar desde un lote con fecha_vencimiento, se copia a fecha_duracion."""
    from src.lotes import schemas as lotes_schemas
    from src.lotes import services as lotes_services
    db, producto, _, version = datos

    # Crear un lote terminado con fecha_vencimiento.
    operador = None
    from src.personal.models import Personal
    op = Personal(nombre="Op", apellido="Test", dni="10000001", email="op@test.local", password="x", puede_operar=True)
    db.info["sin_auditoria"] = True
    try:
        db.add(op)
        db.commit()
        db.refresh(op)
    finally:
        db.info.pop("sin_auditoria", None)

    lote = lotes_services.crear_lote(
        db,
        lotes_schemas.LoteCreate(
            producto_id=producto.id, cantidad_objetivo=Decimal("40")
        ),
        op,
    )
    for item in lote.checklist:
        lotes_services.completar_item(db, lote.id, item.id, op)
    fecha_vencimiento = date(2027, 6, 1)
    lote.fecha_vencimiento = fecha_vencimiento
    db.commit()

    borrador = services.crear_borrador(
        db, producto.id,
        schemas.BorradorRotuladoCreate(
            producto_id=producto.id,
            version_receta_id=version.id,
            lote_producto_id=lote.id,
            denominacion_venta="Manual",
        ),
    )
    resultado = services.autocompletar_borrador(
        db, borrador.id, version.id, lote.id, forzar=False
    )
    assert resultado.fecha_duracion == fecha_vencimiento


def test_producto_inexistente(datos):
    db, _, _, _ = datos
    from src.productos.exceptions import ProductoNoEncontrado
    with pytest.raises(ProductoNoEncontrado):
        services.preview_autocompletado(db, 99999)


def test_composicion_incompleta_informa_faltantes(datos):
    db, producto, _, _ = datos
    unidad = db.get(UnidadMedida, producto.unidad_medida_id)
    unidad.tipo = "volumen"
    db.commit()
    vista = services.preview_autocompletado(db, producto.id)
    assert vista.lista_ingredientes is None
    assert "Frutilla" in vista.mensaje


def test_nutricion_indisponible_no_bloquea(datos, monkeypatch):
    db, producto, _, _ = datos
    monkeypatch.setattr(services, "calcular_nutricion_service", Mock(side_effect=ValueError("Sin datos")))
    vista = services.preview_autocompletado(db, producto.id)
    assert vista.lista_ingredientes
    assert vista.datos_nutricionales_json is None
    assert vista.mensaje


def test_preview_exige_autorizacion(datos):
    db, producto, _, _ = datos
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    assert TestClient(app).get(f"/rotulado/productos/{producto.id}/autocompletar/preview").status_code in (401, 403)


def test_receta_sin_version(datos):
    db, producto, _, _ = datos
    otro = Producto(nombre="Sin versiones", unidad_medida_id=producto.unidad_medida_id)
    db.add(Receta(producto=otro))
    db.commit()
    vista = services.preview_autocompletado(db, otro.id)
    assert vista.denominacion_venta == otro.nombre
    assert vista.version_receta_id is None
    assert vista.mensaje


def test_version_inexistente(datos):
    db, producto, _, _ = datos
    from src.recetas.exceptions import VersionNoEncontrada
    with pytest.raises(VersionNoEncontrada):
        services.preview_autocompletado(db, producto.id, 99999)


def test_nutricion_readonly_equivale_a_parametros_persistidos(datos):
    db, producto, _, version = datos
    from src.nutricion.services import calcular_info_nutricional
    lectura = calcular_info_nutricional(db, producto.id, version.id, inicializar_parametros=False)
    normal = calcular_info_nutricional(db, producto.id, version.id)
    assert lectura.model_dump(exclude={"calculado_en"}) == normal.model_dump(exclude={"calculado_en"})


def test_http_guardar_editar_y_reabrir(datos):
    db, producto, _, version = datos
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_admin] = lambda: None
    client = TestClient(app)
    creado = client.post(f"/rotulado/productos/{producto.id}/borradores", json={"producto_id": producto.id, "version_receta_id": version.id, "denominacion_venta": "Manual", "fecha_duracion": "2027-01-01"})
    assert creado.status_code == 201, creado.text
    borrador_id = creado.json()["id"]
    actualizado = client.patch(f"/rotulado/borradores/{borrador_id}", json={"denominacion_venta": "Editado", "fecha_duracion": None})
    assert actualizado.status_code == 200, actualizado.text
    resultado = client.get(f"/rotulado/borradores/{borrador_id}").json()
    assert resultado["denominacion_venta"] == "Editado"
    assert resultado["producto_nombre"] == producto.nombre
    assert resultado["fecha_duracion"] is None
    historial = client.get(f"/rotulado/borradores/{borrador_id}/historial-ediciones")
    assert historial.status_code == 200, historial.text
    assert len([e for e in historial.json() if e["campo"] != "declaraciones"]) == 2
    assert any(e["campo"] == "declaraciones" for e in historial.json())
