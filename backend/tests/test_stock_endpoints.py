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


def test_stock_actual_paginado_filtra_y_mantiene_compatibilidad(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    db.add(unidad)
    db.flush()

    def crear(nombre, cantidad, minimo, activo=True):
        insumo = InsumoQuimico(
            nombre=nombre,
            tipo=TipoQuimico.DETERGENTE,
            unidad_medida_id=unidad.id,
            activo=activo,
        )
        db.add(insumo)
        db.flush()
        db.add(
            StockInsumoQuimico(
                insumo_quimico_id=insumo.id,
                cantidad_actual=Decimal(cantidad),
                stock_minimo=Decimal(minimo) if minimo is not None else None,
            )
        )
        return insumo

    crear("Alcohol", "1", "2")
    crear("Detergente", "5", "2")
    crear("Jabón", "0", None)
    inactivo = crear("Inactivo histórico", "1", "2", activo=False)
    db.commit()
    client, headers = _client_admin(db)
    try:
        # La ruta histórica no cambia de contrato ni expone el insumo inactivo.
        sin_pagina = client.get("/insumos-quimicos/stock", headers=headers)
        assert sin_pagina.status_code == 200
        assert isinstance(sin_pagina.json(), list)
        assert [item["nombre"] for item in sin_pagina.json()] == ["Alcohol", "Detergente", "Jabón"]

        pagina = client.get(
            "/insumos-quimicos/stock?page=1&page_size=1&orden=cantidad_desc",
            headers=headers,
        )
        assert pagina.status_code == 200
        cuerpo = pagina.json()
        assert cuerpo["total"] == 3
        assert cuerpo["total_paginas"] == 3
        assert cuerpo["items"][0]["nombre"] == "Detergente"

        bajo = client.get(
            "/insumos-quimicos/stock?page=1&page_size=10&buscar=alcohol&stock_bajo=true",
            headers=headers,
        ).json()
        assert bajo["total"] == 1
        assert [item["nombre"] for item in bajo["items"]] == ["Alcohol"]

        disponibles = client.get(
            "/insumos-quimicos/stock?page=1&page_size=10&stock_bajo=false",
            headers=headers,
        ).json()
        assert disponibles["total"] == 2
        assert {item["nombre"] for item in disponibles["items"]} == {"Detergente", "Jabón"}

        opciones = client.get(
            "/insumos-quimicos/opciones?incluir_inactivos=true", headers=headers
        ).json()
        assert inactivo.id in {item["id"] for item in opciones}
    finally:
        app.dependency_overrides.clear()


def test_notificaciones_stock_bajo_paginadas_no_se_duplican_y_desaparecen(db):
    unidad = UnidadMedida(nombre="Litro", simbolo="L")
    insumo = InsumoQuimico(
        nombre="Desinfectante",
        tipo=TipoQuimico.DESINFECTANTE,
        unidad_medida=unidad,
    )
    db.add_all([unidad, insumo])
    db.flush()
    saldo = StockInsumoQuimico(
        insumo_quimico_id=insumo.id,
        cantidad_actual=Decimal("1"),
        stock_minimo=Decimal("2"),
    )
    db.add(saldo)
    db.commit()
    client, headers = _client_admin(db)
    try:
        respuesta = client.get(
            "/notificaciones?page=1&page_size=10&urgencia=stock_bajo&origen=STOCK_BAJO",
            headers=headers,
        )
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["total"] == 1
        assert len(cuerpo["items"]) == 1
        assert cuerpo["items"][0]["id_notificacion"] == f"stock-bajo-{insumo.id}"
        assert cuerpo["contadores"]["urgencia"]["stock_bajo"] == 1
        assert cuerpo["contadores"]["origen"]["STOCK_BAJO"] == 1

        saldo.cantidad_actual = Decimal("2")
        db.commit()
        normalizado = client.get(
            "/notificaciones?page=1&page_size=10&urgencia=stock_bajo&origen=STOCK_BAJO",
            headers=headers,
        ).json()
        assert normalizado["total"] == 0
        assert normalizado["items"] == []
        assert normalizado["contadores"]["urgencia"]["stock_bajo"] == 0
    finally:
        app.dependency_overrides.clear()
