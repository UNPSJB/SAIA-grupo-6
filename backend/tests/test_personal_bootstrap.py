"""Tests del arranque y cierre de la ventana de alta inicial (problema 6).

El primer usuario dado de alta sin sesión pasa a ser super admin y cierra la
ventana inmediatamente. En producción (ENV=PRODUCTION) la alta abierta está
deshabilitada.
"""

from fastapi import status
from fastapi.testclient import TestClient

import src.auth.dependencies as auth_deps
from src.auth.services import crear_access_token
from src.config import settings
from src.database import get_db
from src.main import app
from src.personal.models import Personal


def _client_sin_sesion(db_session):
    """TestClient cuya sesión es `db_session` y sin usuario autenticado."""
    def _get_db():
        yield db_session

    anterior_get_db = app.dependency_overrides.get(get_db)
    anterior_opcional = app.dependency_overrides.get(
        auth_deps.get_current_user_opcional
    )
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[auth_deps.get_current_user_opcional] = lambda: None
    cliente = TestClient(app)
    return cliente, (anterior_get_db, anterior_opcional)


def _cerrar_cliente_sin_sesion(cliente, sobrescritos):
    cliente.close()
    anterior_get_db, anterior_opcional = sobrescritos
    if anterior_get_db is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = anterior_get_db
    if anterior_opcional is None:
        app.dependency_overrides.pop(auth_deps.get_current_user_opcional, None)
    else:
        app.dependency_overrides[auth_deps.get_current_user_opcional] = (
            anterior_opcional
        )


def test_primer_usuario_sin_sesion_es_super_admin_y_cierra_ventana(db_session):
    client, sobrescritos = _client_sin_sesion(db_session)
    try:
        # Ventana abierta: no hay administradores.
        resp = client.post(
            "/personal",
            json={
                "nombre": "Primero",
                "apellido": "Usuario",
                "dni": "98000001",
                "email": "primero@test.local",
                "password": "ClaveSegura123",
                "puede_operar": True,
            },
        )
        assert resp.status_code == 200, resp.text
        cuerpo = resp.json()
        assert cuerpo["es_super_admin"] is True, cuerpo
        assert cuerpo["id"] is not None

        # La ventana se cerró: ya hay un administrador, sin sesión se rechaza.
        resp2 = client.post(
            "/personal",
            json={
                "nombre": "Segundo",
                "apellido": "Usuario",
                "dni": "98000002",
                "email": "segundo@test.local",
                "password": "ClaveSegura123",
                "puede_operar": True,
            },
        )
        assert resp2.status_code == status.HTTP_401_UNAUTHORIZED, resp2.text
    finally:
        _cerrar_cliente_sin_sesion(client, sobrescritos)


def test_alta_abierta_desactivada_en_produccion(db_session, monkeypatch):
    monkeypatch.setattr(settings, "ENV", "PRODUCTION")
    client, sobrescritos = _client_sin_sesion(db_session)
    try:
        resp = client.post(
            "/personal",
            json={
                "nombre": "Primero",
                "apellido": "Usuario",
                "dni": "98000011",
                "email": "primero.prod@test.local",
                "password": "ClaveSegura123",
                "puede_operar": True,
            },
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN, resp.text
    finally:
        _cerrar_cliente_sin_sesion(client, sobrescritos)


def test_con_sesion_admin_puede_crear_en_produccion(db_session, monkeypatch):
    """En producción, con sesión de administrador la alta sigue permitida."""
    monkeypatch.setattr(settings, "ENV", "PRODUCTION")

    admin = Personal(
        nombre="Admin", apellido="Prod", dni="98000021",
        email="admin.prod@test.local", password="x",
        puede_administrar=True, puede_operar=True, es_super_admin=True,
        activo=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    token, _, _ = crear_access_token(str(admin.id))

    def _get_db():
        yield db_session

    anterior_get_db = app.dependency_overrides.get(get_db)
    anterior_opcional = app.dependency_overrides.get(
        auth_deps.get_current_user_opcional
    )
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[auth_deps.get_current_user_opcional] = lambda: admin
    client = TestClient(app)
    try:
        resp = client.post(
            "/personal",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "nombre": "Nuevo",
                "apellido": "Operador",
                "dni": "98000022",
                "email": "nuevo.prod@test.local",
                "password": "ClaveSegura123",
                "puede_operar": True,
                "puede_administrar": False,
            },
        )
        assert resp.status_code == 200, resp.text
    finally:
        client.close()
        if anterior_get_db is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior_get_db
        if anterior_opcional is None:
            app.dependency_overrides.pop(auth_deps.get_current_user_opcional, None)
        else:
            app.dependency_overrides[auth_deps.get_current_user_opcional] = (
                anterior_opcional
            )

