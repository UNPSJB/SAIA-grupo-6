"""Tests unitarios de services del módulo `auth` (hash, tokens, intentos, revocación).

Usa pocos hashes bcrypt por test (criterio: bcrypt es lento).
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from src.auth import services
from src.auth.models import IntentoLogin, TokenRevocado
from src.config import settings
from src.personal.models import Personal
from tests.database import db_session


def _personal_admin(db, dni="12345678", email="a@test.com", id_=123):
    fila = Personal(
        id=id_,
        nombre="Admin", apellido="A", dni=dni, email=email, password="h",
        puede_operar=True, puede_administrar=True, es_super_admin=False,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# Hash de contraseñas (pocos hashes: bcrypt es lento)
# ---------------------------------------------------------------------------

def test_hashear_password_y_verificar_password():
    # Arrange
    password = "mi-segura-123"

    # Act (un solo hash por test)
    hash_almacenado = services.hashear_password(password)

    # Assert
    assert services.es_hash_bcrypt(hash_almacenado) is True
    assert services.verificar_password(password, hash_almacenado) is True
    assert services.verificar_password("otra-contrasena", hash_almacenado) is False


def test_es_hash_bcrypt_valido_e_invalido():
    # Arrange / Act / Assert
    assert services.es_hash_bcrypt("$2b$12$abcdefghijklmnopqrstuv") is True
    assert services.es_hash_bcrypt("$2y$12$abcdefghijklmnopqrstuv") is True
    assert services.es_hash_bcrypt("no-es-un-hash") is False
    assert services.es_hash_bcrypt("") is False


# ---------------------------------------------------------------------------
# Tokens JWT
# ---------------------------------------------------------------------------

def test_crear_y_decodificar_access_token():
    # Arrange
    subject = "123"

    # Act
    token, jti, expira = services.crear_access_token(subject)
    payload = services.decodificar_token(token, token_type="access")

    # Assert
    assert isinstance(token, str)
    assert len(token) > 0
    assert payload["sub"] == subject
    assert payload["type"] == "access"
    assert payload["jti"] == jti


def test_decodificar_token_tipo_incorrecto():
    # Arrange
    token, _, _ = services.crear_access_token("123")

    # Act / Assert
    assert services.decodificar_token(token, token_type="refresh") is None


def test_decodificar_token_valor_invalido():
    # Arrange / Act / Assert
    assert services.decodificar_token("no-es-un-token-valido") is None


# ---------------------------------------------------------------------------
# Intentos de login (anti fuerza bruta)
# ---------------------------------------------------------------------------

def test_verificar_intentos_permitidos_sin_intentos(db_session):
    # Arrange

    # Act (no debe lanzar)
    services.verificar_intentos_permitidos(db_session, ip="1.2.3.4", dni="12345678")


def test_registrar_y_verificar_intentos_llega_al_maximo(db_session):
    # Arrange
    ip = "1.2.3.4"
    dni = "12345678"
    maximo = settings.LOGIN_MAX_INTENTOS

    # Act: registrar (maximo - 1) fallidos (no bloquea aún)
    for _ in range(maximo - 1):
        services.registrar_intento_fallido(db_session, ip=ip, dni=dni)

    # No debe lanzar aún
    services.verificar_intentos_permitidos(db_session, ip=ip, dni=dni)

    # El siguiente intento fallido alcanza el máximo y bloquea
    services.registrar_intento_fallido(db_session, ip=ip, dni=dni)

    # Act / Assert: ahora sí debe bloquear
    try:
        services.verificar_intentos_permitidos(db_session, ip=ip, dni=dni)
    except Exception as e:
        assert e.status_code == 429
    else:
        raise AssertionError("Se esperaba HTTP 429")


def test_limpiar_intentos_tras_login_exitoso(db_session):
    # Arrange
    ip = "5.6.7.8"
    dni = "87654321"
    services.registrar_intento_fallido(db_session, ip=ip, dni=dni)

    # Act
    services.limpiar_intentos(db_session, ip=ip, dni=dni)

    # Assert: verificar_intentos_permitidos no debe bloquear (no hay registro)
    services.verificar_intentos_permitidos(db_session, ip=ip, dni=dni)


# ---------------------------------------------------------------------------
# Revocación de tokens
# ---------------------------------------------------------------------------

def test_revocar_y_token_revocado(db_session):
    # Arrange
    _personal_admin(db_session, id_=123)
    token, jti, expira = services.crear_access_token("123")

    # Act
    services.revocar_token(db_session, jti=jti, usuario_id=123, tipo="access", expira=expira)
    db_session.commit()

    # Assert
    assert services.token_revocado(db_session, jti=jti) is True


def test_revocar_token_duplicado_no_falla(db_session):
    # Arrange
    _personal_admin(db_session, id_=123)
    token, jti, expira = services.crear_access_token("123")
    services.revocar_token(db_session, jti=jti, usuario_id=123, tipo="access", expira=expira)
    db_session.commit()

    # Act (revocar de nuevo no debe fallar)
    services.revocar_token(db_session, jti=jti, usuario_id=123, tipo="access", expira=expira)
    db_session.commit()

    # Assert
    assert services.token_revocado(db_session, jti=jti) is True


def test_token_revocado_jti_none(db_session):
    # Arrange / Act / Assert
    assert services.token_revocado(db_session, jti=None) is False
    assert services.token_revocado(db_session, jti="") is False


# ---------------------------------------------------------------------------
# Revocación de tokens desde payload (revocar_tokens)
# ---------------------------------------------------------------------------

def test_revocar_tokens_desde_payload(db_session):
    # Arrange
    _personal_admin(db_session, id_=123)
    access_token, _, _ = services.crear_access_token("123")

    # Act
    revocados = services.revocar_tokens(
        db_session, {"access": access_token, "refresh": None}
    )

    # Assert
    assert revocados == 1
