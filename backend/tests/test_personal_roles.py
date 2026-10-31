"""Tests de la jerarquía de roles al dar de alta personal (problema 5).

Cada test usa un cliente aislado sobre `db_session` (base vacía), así no hay
contaminación entre tests ni con el suite completo. El alta (POST /personal)
y la edición (PUT) aplican las mismas reglas: un admin común no puede crear
a otro admin ni a un super admin; solo el super admin puede conceder esos
flags.
"""

from fastapi import status
from fastapi.testclient import TestClient

import src.auth.dependencies as auth_deps
from src.auth.services import crear_access_token
from src.database import get_db
from src.main import app
from src.personal.models import Personal


def _client_con_actor(db_session, puede_administrar: bool, es_super_admin: bool):
    """Actor en la base aislada + TestClient autenticado como ese actor."""
    i = _client_con_actor.c
    _client_con_actor.c += 1
    actor = Personal(
        nombre="Actor",
        apellido="Roles",
        dni=f"970000{i}",
        email=f"actor.roles.{i}@test.local",
        password="x",
        puede_administrar=puede_administrar,
        puede_operar=True,
        es_super_admin=es_super_admin,
        activo=True,
    )
    db_session.add(actor)
    db_session.commit()
    db_session.refresh(actor)
    token, _, _ = crear_access_token(str(actor.id))

    def _get_db():
        yield db_session

    anterior_get_db = app.dependency_overrides.get(get_db)
    anterior_opcional = app.dependency_overrides.get(
        auth_deps.get_current_user_opcional
    )
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[auth_deps.get_current_user_opcional] = lambda: actor
    cliente = TestClient(app)
    return (
        cliente,
        {"Authorization": f"Bearer {token}"},
        (anterior_get_db, anterior_opcional),
    )


def _cerrar_cliente_actor(cliente, sobrescritos):
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


_client_con_actor.c = 0


def _persona_payload(dni: str, email: str, es_admin: bool = False, es_sa: bool = False):
    return {
        "nombre": "Nueva",
        "apellido": "Persona",
        "dni": dni,
        "email": email,
        "puede_operar": True,
        "puede_administrar": es_admin,
        "es_super_admin": es_sa,
    }


def test_admin_comun_no_puede_crear_admin(db_session):
    client, headers, sobrescritos = _client_con_actor(
        db_session, puede_administrar=True, es_super_admin=False
    )
    try:
        resp = client.post(
            "/personal",
            headers=headers,
            json=_persona_payload("97000010", "nueva.admin@test.local", es_admin=True),
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN, resp.text
    finally:
        _cerrar_cliente_actor(client, sobrescritos)


def test_admin_comun_no_puede_crear_super_admin(db_session):
    client, headers, sobrescritos = _client_con_actor(
        db_session, puede_administrar=True, es_super_admin=False
    )
    try:
        resp = client.post(
            "/personal",
            headers=headers,
            json=_persona_payload("97000011", "nueva.sa@test.local", es_sa=True),
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN, resp.text
    finally:
        _cerrar_cliente_actor(client, sobrescritos)


def test_super_admin_puede_crear_admin(db_session):
    client, headers, sobrescritos = _client_con_actor(
        db_session, puede_administrar=True, es_super_admin=True
    )
    try:
        resp = client.post(
            "/personal",
            headers=headers,
            json=_persona_payload("97000012", "nueva.admin2@test.local", es_admin=True),
        )
        assert resp.status_code == 200, resp.text
    finally:
        _cerrar_cliente_actor(client, sobrescritos)


def test_super_admin_puede_crear_super_admin(db_session):
    client, headers, sobrescritos = _client_con_actor(
        db_session, puede_administrar=True, es_super_admin=True
    )
    try:
        resp = client.post(
            "/personal",
            headers=headers,
            json=_persona_payload("97000013", "nueva.sa2@test.local", es_sa=True),
        )
        assert resp.status_code == 200, resp.text
    finally:
        _cerrar_cliente_actor(client, sobrescritos)


def test_operador_no_puede_crear_nadie(db_session):
    # Ya hay un administrador en la base: no estamos en arranque, así que el
    # operador no puede dar de alta a nadie.
    admin = Personal(
        nombre="Admin", apellido="Existente", dni="97000001",
        email="admin.existente@test.local", password="x",
        puede_administrar=True, puede_operar=True, es_super_admin=False,
        activo=True,
    )
    db_session.add(admin)
    db_session.commit()

    client, headers, sobrescritos = _client_con_actor(
        db_session, puede_administrar=False, es_super_admin=False
    )
    try:
        resp = client.post(
            "/personal",
            headers=headers,
            json=_persona_payload("97000014", "nadie@test.local"),
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN, resp.text
    finally:
        _cerrar_cliente_actor(client, sobrescritos)
