"""Tests de rate limiting y rotación atómica de refresh tokens (problema 11).
"""

import pytest
from fastapi import status

from src.auth.services import hashear_password
from src.personal.models import Personal


def _login(client, dni, password):
    return client.post("/auth/login", json={"dni": dni, "password": password})


def test_rate_limite_bloquea_despues_de_maximos_intentos(client, session_factory):
    """Tras LOGIN_MAX_INTENTOS (5) fallos, el siguiente login devuelve 429."""
    with session_factory() as db:
        user = Personal(
            nombre="Rate",
            apellido="Limit",
            dni="11111113",
            email="rate.limit@test.com",
            password=hashear_password("clave1234"),
            puede_operar=True,
            activo=True,
        )
        db.add(user)
        db.commit()

    dni = "11111113"
    # 5 fallos: los 5 primeros devuelven 401 (registran el intento).
    for _ in range(5):
        resp = _login(client, dni, "clave-incorrecta")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED, resp.text

    # El 6to se bloquea antes de autenticar.
    resp = _login(client, dni, "clave-incorrecta")
    assert resp.status_code == status.HTTP_429_TOO_MANY_REQUESTS, resp.text
    assert "Retry-After" in resp.headers


def test_rate_limite_es_por_dni(client, session_factory):
    """DNI distinto no comparte el contador de intentos."""
    with session_factory() as db:
        user = Personal(
            nombre="Otro",
            apellido="Usuario",
            dni="11111114",
            email="otro@test.com",
            password=hashear_password("clave1234"),
            puede_operar=True,
            activo=True,
        )
        db.add(user)
        db.commit()

    # Agotar los intentos de otro DNI no afecta a este.
    otro_dni = "11111115"
    with session_factory() as db:
        otro = Personal(
            nombre="Agotado",
            apellido="Usuario",
            dni=otro_dni,
            email="agotado@test.com",
            password=hashear_password("clave1234"),
            puede_operar=True,
            activo=True,
        )
        db.add(otro)
        db.commit()
    for _ in range(5):
        _login(client, otro_dni, "clave-incorrecta")

    # Este DNI aún puede intentar (devuelve 401 por credenciales, no 429).
    resp = _login(client, "11111114", "clave-incorrecta")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED, resp.text


def test_refresh_rotacion_atomica_solo_uno_prospera(client, session_factory):
    """La rotación de refresh tokens es atómica: un token usado no se puede
    reutilizar (marcado con UPDATE ... WHERE usado = 0 y rowcount == 1).

    Dos usos concurrentes del mismo token solo dejarían prosperar uno: el
    primero marca el token como usado (rowcount == 1) y el segundo falla
    con 401 e invalida la familia.
    """
    with session_factory() as db:
        user = Personal(
            nombre="Refresh",
            apellido="Atomico",
            dni="11111116",
            email="refresh.atomico@test.com",
            password=hashear_password("clave1234"),
            puede_operar=True,
            puede_administrar=True,
            activo=True,
        )
        db.add(user)
        db.commit()

    # Login exitoso: registra el refresh token en BD.
    resp = _login(client, "11111116", "clave1234")
    assert resp.status_code == status.HTTP_200_OK, resp.text
    refresh_token = resp.json()["refresh_token"]

    # Primer uso: rotación atómica exitosa.
    resp1 = client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert resp1.status_code == status.HTTP_200_OK, resp1.text

    # Reuso del mismo token ya usado: se rechaza con 401 y se invalida la familia.
    resp2 = client.post(
        "/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert resp2.status_code == status.HTTP_401_UNAUTHORIZED, resp2.text
