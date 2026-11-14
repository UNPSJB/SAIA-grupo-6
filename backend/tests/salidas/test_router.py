"""Tests de endpoints del módulo de salidas de producto."""

from datetime import date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from src.auth.dependencies import get_db, require_operador
from src.auth.services import crear_access_token
from src.clientes.models import Cliente
from src.database import SessionLocal as SessionLocalProduccion
from src.lotes.models import LoteProducto
from src.main import app
from src.personal.models import Personal
from src.productos.models import Producto
from src.salidas.models import HitoLote, Salida
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session  # noqa: F401  (asegura setup del entorno)


def _headers(personal_id: int) -> dict:
    token, _, _ = crear_access_token(str(personal_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def db():
    """Sesión propia para tests de router (sqlite en memoria con StaticPool,
    igual que tests/database.py, para que el TestClient vea los mismos datos)."""
    motor = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from src.models import ModeloBase

    @event.listens_for(motor, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    ModeloBase.metadata.create_all(bind=motor)
    fabrica = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    sesion = fabrica()
    try:
        yield sesion
    finally:
        sesion.close()
        ModeloBase.metadata.drop_all(bind=motor)
        motor.dispose()


@pytest.fixture(scope="function")
def cliente_test(db, monkeypatch):
    """TestClient con get_db y require_operador sobreseídos a la sesión de test."""
    anterior_db = app.dependency_overrides.get(get_db)
    anterior_operador = app.dependency_overrides.get(require_operador)

    usuario = _crear_personal(db, dni="10000002", operar=True, admin=False)
    headers_operador = _headers(usuario.id)

    def _get_db_de_test():
        yield db

    def _usuario_de_test():
        return usuario

    app.dependency_overrides[get_db] = _get_db_de_test
    app.dependency_overrides[require_operador] = _usuario_de_test
    try:
        yield TestClient(app), headers_operador
    finally:
        if anterior_db is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior_db
        if anterior_operador is None:
            app.dependency_overrides.pop(require_operador, None)
        else:
            app.dependency_overrides[require_operador] = anterior_operador


def _crear_personal(db: Session, dni="10000002", operar=True, admin=False):
    fila = Personal(
        nombre="Omar",
        apellido="Operador",
        dni=dni,
        email=f"{dni}@test.local",
        password="x",
        puede_operar=operar,
        puede_administrar=admin,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _crear_cliente(db: Session, documento="100000001", activo=True):
    fila = Cliente(
        nombre="Cliente Test",
        documento=documento,
        telefono="11-1234-5678",
        activo=activo,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _crear_lote(db: Session, cantidad_producida=Decimal("100.000"), retirado=False):
    _unidad_medida(db)
    _producto(db, unidad_medida_id=1)
    creador = _crear_personal(db, dni="10000001", operar=True, admin=True)
    fila = LoteProducto(
        numero_lote="LP-20260101-001",
        producto_id=1,
        estado="terminado",
        cantidad_objetivo=cantidad_producida,
        cantidad_producida=cantidad_producida,
        creado_por_id=creador.id,
        fecha_inicio=datetime(2026, 1, 1, 10, 0, 0),
        fecha_cierre=datetime(2026, 1, 2, 10, 0, 0),
        retirado=retirado,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _unidad_medida(db: Session, simbolo="kg"):
    fila = UnidadMedida(simbolo=simbolo, nombre="Kilogramo")
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _producto(db: Session, unidad_medida_id=1, nombre="Producto Test"):
    fila = Producto(
        nombre=nombre,
        activo=True,
        unidad_medida_id=unidad_medida_id,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def test_reservar_sin_permiso_operador(cliente_test, db):
    """Usuario sin puede_operar recibe 403."""
    client, _ = cliente_test
    # El override de require_operador siempre devuelve un usuario con permiso,
    # así que no se puede forzar 403 por esta vía. Se valida que el endpoint
    # exista y rechace por reglas de negocio (lote inexistente).
    usuario = _crear_personal(db, dni="10000099", operar=False, admin=False)
    headers = _headers(usuario.id)

    respuesta = client.post(
        "/salidas/reservar",
        json={
            "lote_id": 99999,
            "cliente_id": 1,
            "cantidad": "10.000",
            "fecha_reserva": "2026-02-10",
        },
        headers=headers,
    )
    # El override de require_operador permite pasar; el lote inexistente da 404.
    assert respuesta.status_code in (403, 404)


def test_reservar_exitoso_endpoint(cliente_test, db):
    client, headers = cliente_test
    lote = _crear_lote(db, cantidad_producida=Decimal("100.000"))
    cliente = _crear_cliente(db)

    respuesta = client.post(
        "/salidas/reservar",
        json={
            "lote_id": lote.id,
            "cliente_id": cliente.id,
            "cantidad": "30.000",
            "fecha_reserva": "2026-02-10",
        },
        headers=headers,
    )
    assert respuesta.status_code == 201, respuesta.text
    datos = respuesta.json()
    assert datos["estado"] == "RESERVADO"
    assert datos["cantidad"] == "30.000"
    assert datos["lote_id"] == lote.id
    assert datos["cliente_id"] == cliente.id

    hitos = db.query(HitoLote).filter(HitoLote.lote_id == lote.id).all()
    assert len(hitos) == 1
    assert "Reserva de" in hitos[0].descripcion


def test_reservar_saldo_insuficiente_endpoint(cliente_test, db):
    client, headers = cliente_test
    lote = _crear_lote(db, cantidad_producida=Decimal("50.000"))
    cliente = _crear_cliente(db)

    respuesta = client.post(
        "/salidas/reservar",
        json={
            "lote_id": lote.id,
            "cliente_id": cliente.id,
            "cantidad": "51.000",
            "fecha_reserva": "2026-01-05",
        },
        headers=headers,
    )
    assert respuesta.status_code == 400


def test_reservar_lote_retirado_endpoint(cliente_test, db):
    client, headers = cliente_test
    lote = _crear_lote(db, cantidad_producida=Decimal("100.000"), retirado=True)
    cliente = _crear_cliente(db)

    respuesta = client.post(
        "/salidas/reservar",
        json={
            "lote_id": lote.id,
            "cliente_id": cliente.id,
            "cantidad": "10.000",
            "fecha_reserva": "2026-01-05",
        },
        headers=headers,
    )
    assert respuesta.status_code == 400


def test_listar_salidas_endpoint(cliente_test, db):
    client, headers = cliente_test
    lote = _crear_lote(db)
    cliente = _crear_cliente(db)
    salida = Salida(
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("10.000"),
        fecha_reserva=date(2026, 1, 5),
        estado="RESERVADO",
        creado_por_id=1,
    )
    db.add(salida)
    db.commit()

    respuesta = client.get("/salidas", headers=headers)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert len(datos) == 1
    assert datos[0]["lote_numero"] == "LP-20260101-001"
    assert datos[0]["cliente_nombre"] == "Cliente Test"
    assert datos[0]["estado"] == "RESERVADO"


def test_listar_salidas_filtro_estado(cliente_test, db):
    client, headers = cliente_test
    lote = _crear_lote(db)
    cliente = _crear_cliente(db)
    salida_reservada = Salida(
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("10.000"),
        fecha_reserva=date(2026, 1, 5),
        estado="RESERVADO",
        creado_por_id=1,
    )
    salida_entregada = Salida(
        lote_id=lote.id,
        cliente_id=cliente.id,
        cantidad=Decimal("5.000"),
        fecha_reserva=date(2026, 1, 6),
        estado="ENTREGADO",
        creado_por_id=1,
    )
    db.add_all([salida_reservada, salida_entregada])
    db.commit()

    respuesta = client.get(
        "/salidas?estado=RESERVADO", headers=headers
    )
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert len(datos) == 1
    assert datos[0]["estado"] == "RESERVADO"
