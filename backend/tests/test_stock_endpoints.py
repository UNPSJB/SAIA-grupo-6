from decimal import Decimal

from fastapi.testclient import TestClient

from src.auth.services import crear_access_token
from src.database import get_db
from src.insumoQuimico.models import InsumoQuimico, LoteStock, StockInsumoQuimico, TipoQuimico
from src.main import app
from src.personal.models import Personal
from src.proveedores.models import Proveedor
from src.unidadMedida.models import UnidadMedida


def _client_admin(db):
    # sqlite:// usa una base por conexión; fijamos esta sesión a la conexión que
    # creó el fixture para que el worker thread de TestClient vea las mismas tablas.
    db.connection()
    admin = Personal(
        nombre="Ana",
        apellido="Admin",
        dni="12345678",
        email="ana@example.com",
        password="hash",
        puede_operar=True,
        puede_administrar=True,
    )
    db.add(admin)
    db.commit()
    token, _, _ = crear_access_token(str(admin.id))

    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    return TestClient(app), {"Authorization": f"Bearer {token}"}


def test_endpoints_proveedores_permiten_abm_y_reactivacion(db):
    client, headers = _client_admin(db)
    try:
        creado = client.post(
            "/proveedores", json={"nombre": "Proveedor A", "matricula": "MAT-001"}, headers=headers
        )
        assert creado.status_code == 201
        proveedor_id = creado.json()["id"]

        assert client.get("/proveedores", headers=headers).json()[0]["id"] == proveedor_id
        assert client.delete(f"/proveedores/{proveedor_id}", headers=headers).json()["activo"] is False
        assert client.get("/proveedores", headers=headers).json() == []
        reactivado = client.put(
            f"/proveedores/{proveedor_id}",
            json={"nombre": "Proveedor A", "matricula": "MAT-001", "activo": True},
            headers=headers,
        )
        assert reactivado.status_code == 200
        assert reactivado.json()["activo"] is True
    finally:
        app.dependency_overrides.clear()


def test_ingreso_endpoint_crea_lote_inmutable_y_actualiza_stock(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    proveedor = Proveedor(nombre="Proveedor A", matricula="MAT-001")
    db.add_all([unidad, proveedor])
    db.flush()
    insumo = InsumoQuimico(nombre="Detergente", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=unidad.id)
    db.add(insumo)
    db.flush()
    db.add(StockInsumoQuimico(insumo_quimico_id=insumo.id))
    db.commit()
    client, headers = _client_admin(db)
    try:
        respuesta = client.post(
            f"/insumos-quimicos/{insumo.id}/stock/ingresos",
            json={"cantidad": "5", "proveedor_id": proveedor.id, "numero_lote": "000123"},
            headers=headers,
        )
        assert respuesta.status_code == 201
        lote = db.query(LoteStock).one()
        assert lote.numero_lote == "000123"
        assert lote.cantidad_producto == Decimal("5.000")
        assert lote.movimiento_ingreso_id is not None
        assert db.get(StockInsumoQuimico, insumo.id).cantidad_actual == Decimal("5.000")

        consulta = client.get("/insumos-quimicos/stock/lotes?numero_lote=000123", headers=headers)
        assert consulta.status_code == 200
        assert consulta.json()["items"][0]["movimiento_ingreso_id"] == lote.movimiento_ingreso_id
    finally:
        app.dependency_overrides.clear()


def test_notificaciones_stock_bajo_se_exponen_por_endpoint(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    db.add(unidad)
    db.flush()
    insumo = InsumoQuimico(nombre="Desinfectante", tipo=TipoQuimico.DESINFECTANTE, unidad_medida_id=unidad.id)
    db.add(insumo)
    db.flush()
    db.add(StockInsumoQuimico(insumo_quimico_id=insumo.id, cantidad_actual=1, stock_minimo=2))
    db.commit()
    client, headers = _client_admin(db)
    try:
        respuesta = client.get("/notificaciones", headers=headers)
        assert respuesta.status_code == 200
        alertas = [item for item in respuesta.json() if item["tipo"] == "STOCK_BAJO"]
        assert len(alertas) == 1
        assert alertas[0]["id_notificacion"] == f"stock-bajo-{insumo.id}"
    finally:
        app.dependency_overrides.clear()
