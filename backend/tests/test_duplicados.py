"""Tests de reporte de duplicados (problema 8).

Verifica que solo una violación UNIQUE real se informe como duplicado
(DniDuplicado / EmailDuplicado / NombrePlanDuplicado, 400), mientras que
cualquier otro IntegrityError (NOT NULL, FK rota) se propague como error
genérico (500) sin informarse como "duplicado".
"""

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

import src.auth.dependencies as auth_deps
from src.auth.services import crear_access_token
from src.database import get_db
from src.main import app
from src.personal.models import Personal
from src.personal.services import _mapear_conflicto_persona
from src.personal import exceptions as personal_exceptions
from src.PlanLimpieza.services import _mapear_conflicto_plan_limpieza
from src.PlanLimpieza import exceptions as plan_exceptions


_c_i = 0


def _siguiente_i():
    global _c_i
    _c_i += 1
    return _c_i


def _client_con_admin(db_session):
    admin = Personal(
        nombre="Admin", apellido="Dup", dni=f"950000{_siguiente_i()}",
        email=f"admin.dup.{_siguiente_i()}@test.local", password="x",
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
    cliente = TestClient(app)
    return cliente, {"Authorization": f"Bearer {token}"}, (
        anterior_get_db,
        anterior_opcional,
    )


def _cerrar_cliente(cliente, sobrescritos):
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


# ── Mapeador directo (sin DB) ──────────────────────────────────────────

def test_mapeador_persona_unique_dni():
    exc = _mapear_conflicto_persona("unique constraint failed: personal.dni")
    assert isinstance(exc, personal_exceptions.DniDuplicado)
    assert exc.status_code == 400


def test_mapeador_persona_unique_email():
    exc = _mapear_conflicto_persona("unique constraint failed: personal.email")
    assert isinstance(exc, personal_exceptions.EmailDuplicado)
    assert exc.status_code == 400


def test_mapeador_persona_no_null_no_se_informa_como_duplicado():
    """Un NOT NULL (p. ej. personal.dni) no debe ser DniDuplicado."""
    with pytest.raises(IntegrityError):
        _mapear_conflicto_persona("not null constraint failed: personal.dni")


def test_mapeador_persona_fk_rota_no_se_informa_como_duplicado():
    """Una FK rota no debe ser DniDuplicado ni EmailDuplicado."""
    with pytest.raises(IntegrityError):
        _mapear_conflicto_persona(
            "foreign key constraint failed: personal.autor_id"
        )


def test_mapeador_plan_unique_nombre():
    exc = _mapear_conflicto_plan_limpieza(
        "unique constraint failed: plan_limpieza.nombre"
    )
    assert isinstance(exc, plan_exceptions.NombrePlanDuplicado)
    assert exc.status_code == 400


def test_mapeador_plan_no_null_no_se_informa_como_duplicado():
    with pytest.raises(IntegrityError):
        _mapear_conflicto_plan_limpieza(
            "not null constraint failed: plan_limpieza.nombre"
        )


# ── Integración vía API ────────────────────────────────────────────────

def test_post_personal_dni_duplicado(db_session):
    client, headers, sobrescritos = _client_con_admin(db_session)
    try:
        payload = {
            "nombre": "Ana", "apellido": "Perez", "dni": "95000100",
            "email": "ana.perez@test.local", "password": "Clave1234",
            "puede_operar": True,
        }
        r1 = client.post("/personal", headers=headers, json=payload)
        assert r1.status_code == 200, r1.text

        # Mismo DNI -> 400 DniDuplicado (por _verificar_disponibilidad).
        r2 = client.post("/personal", headers=headers, json=payload)
        assert r2.status_code == 400, r2.text
    finally:
        _cerrar_cliente(client, sobrescritos)


def test_post_personal_email_duplicado(db_session):
    client, headers, sobrescritos = _client_con_admin(db_session)
    try:
        payload = {
            "nombre": "Ana", "apellido": "Perez", "dni": "95000101",
            "email": "dup.email@test.local", "password": "Clave1234",
            "puede_operar": True,
        }
        client.post("/personal", headers=headers, json=payload)
        payload2 = dict(payload, dni="95000102")
        r = client.post("/personal", headers=headers, json=payload2)
        assert r.status_code == 400, r.text
    finally:
        _cerrar_cliente(client, sobrescritos)


def test_post_plan_limpieza_nombre_duplicado(db_session):
    client, headers, sobrescritos = _client_con_admin(db_session)
    try:
        from src.sector.models import Sector
        from src.Equipo.models import Equipo

        sector = Sector(nombre=f"Sector dup {_siguiente_i()}", activo=True)
        db_session.add(sector)
        db_session.flush()
        equipo = Equipo(
            nombre=f"Equipo dup {_siguiente_i()}", tipo="Medición",
            sector_id=sector.id, activo=True,
        )
        db_session.add(equipo)
        db_session.flush()

        payload = {
            "nombre": "Plan Dup",
            "equipo_id": equipo.id,
            "tareas": [
                {"nombre": "Limpiar", "frecuencia": 1, "tipo": "operacional",
                 "descripcion": "d", "observaciones": None}
            ],
        }
        r1 = client.post(
            "/planes-limpieza", headers=headers, json=payload
        )
        assert r1.status_code == 200, r1.text

        r2 = client.post(
            "/planes-limpieza", headers=headers, json=payload
        )
        assert r2.status_code == 400, r2.text
    finally:
        _cerrar_cliente(client, sobrescritos)
