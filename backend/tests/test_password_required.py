"""Tests de la exigencia de contraseña cambiada (problema 7).

Un usuario con `debe_cambiar_password=True` YA NO recibe 403: se le permite
seguir operando. El frontend es el encargado de mostrarle una notificación
recordándole que debe cambiar su contraseña.
"""

from fastapi import status
from fastapi.testclient import TestClient

from src.auth.services import crear_access_token
from src.database import get_db
from src.main import app
from src.personal.models import Personal


def _client_con_db(db_session):
    def _get_db():
        yield db_session

    anterior_get_db = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    cliente = TestClient(app)
    return cliente, anterior_get_db


def _cerrar_cliente_db(cliente, anterior_get_db):
    cliente.close()
    if anterior_get_db is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = anterior_get_db


def test_usuario_con_debe_cambiar_password_ya_no_recibe_403(db_session):
    usuario = Personal(
        nombre="Bloqueado",
        apellido="Usuario",
        dni="99000001",
        email="bloqueado@test.local",
        password="x",
        puede_administrar=False,
        puede_operar=True,
        es_super_admin=False,
        activo=True,
        debe_cambiar_password=True,
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)

    token, _, _ = crear_access_token(str(usuario.id))
    headers = {"Authorization": f"Bearer {token}"}

    client, anterior_get_db = _client_con_db(db_session)
    try:
        resp = client.put(
            f"/personal/{usuario.id}",
            headers=headers,
            json={
                "nombre": "Bloqueado",
                "apellido": "Usuario",
                "dni": "99000001",
                "email": "bloqueado@test.local",
                "puede_operar": True,
            },
        )
        # Ya no se bloquea con 403: se permite operar.
        assert resp.status_code == status.HTTP_200_OK, resp.text
    finally:
        _cerrar_cliente_db(client, anterior_get_db)


def test_usuario_sin_debe_cambiar_password_puede_editarse(db_session):
    usuario = Personal(
        nombre="OK",
        apellido="Usuario",
        dni="99000002",
        email="ok@test.local",
        password="x",
        puede_administrar=False,
        puede_operar=True,
        es_super_admin=False,
        activo=True,
        debe_cambiar_password=False,
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)

    token, _, _ = crear_access_token(str(usuario.id))
    headers = {"Authorization": f"Bearer {token}"}

    client, anterior_get_db = _client_con_db(db_session)
    try:
        resp = client.put(
            f"/personal/{usuario.id}",
            headers=headers,
            json={
                "nombre": "OK",
                "apellido": "Usuario",
                "dni": "99000002",
                "email": "ok@test.local",
                "puede_operar": True,
            },
        )
        assert resp.status_code == 200, resp.text
    finally:
        _cerrar_cliente_db(client, anterior_get_db)
