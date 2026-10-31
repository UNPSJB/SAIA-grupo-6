import pytest
from fastapi import status
from pydantic import ValidationError

from src.config import Settings
from src.auth.services import es_hash_bcrypt, verificar_password, obtener_ip_cliente, token_posterior_a_cambio_password
from src.personal.services import _DUMMY_PASSWORD_HASH
from datetime import datetime, timedelta


def test_put_tareas_null_no_500_y_no_modifica(client, session_factory, usuarios):
    from src.PlanLimpieza.models import PlanLimpieza
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    from src.personal.models import Personal
    from src.tareas.models import Tarea

    from src.tareas.constants import TipoTarea

    # crear equipo, plan y tarea
    with session_factory() as db:
        sector = Sector(nombre="t", activo=True)
        db.add(sector); db.flush()
        equipo = Equipo(nombre="E", tipo="T", sector_id=sector.id, activo=True)
        db.add(equipo); db.flush()
        autor = db.get(Personal, usuarios["admin_id"])
        plan = PlanLimpieza(nombre="P", equipo_id=equipo.id, activo=True, autor_id=autor.id)
        db.add(plan); db.flush()
        tarea = Tarea(nombre="Tarea1", frecuencia=1, tipo=TipoTarea.OPERACIONAL.value, plan_limpieza_id=plan.id, activo=True)
        db.add(tarea); db.commit()
        tarea_id = tarea.id

    headers = usuarios["admin"]
    for campo in ["nombre", "frecuencia", "tipo"]:
        resp = client.put(f"/tareas/{tarea_id}", json={campo: None}, headers=headers)
        # No devuelve 500 (puede devolver 400 si el schema rechaza el null,
        # pero en ningun caso modifica el campo)
        assert resp.status_code != 500, resp.text

    # verificar que la tarea sigue igual en DB
    with session_factory() as db:
        t = db.get(Tarea, tarea_id)
        assert t.nombre == "Tarea1"
        assert t.frecuencia == 1
        assert t.tipo == TipoTarea.OPERACIONAL.value


def test_renombrar_tarea_nombre_inactiva_funciona_y_activa_falla(client, session_factory, usuarios):
    from src.PlanLimpieza.models import PlanLimpieza
    from src.Equipo.models import Equipo
    from src.sector.models import Sector
    from src.personal.models import Personal
    from src.tareas.models import Tarea
    from src.tareas.constants import TipoTarea

    with session_factory() as db:
        sector = Sector(nombre="t2", activo=True)
        db.add(sector); db.flush()
        equipo = Equipo(nombre="E2", tipo="T", sector_id=sector.id, activo=True)
        db.add(equipo); db.flush()
        autor = db.get(Personal, usuarios["admin_id"])
        plan = PlanLimpieza(nombre="P2", equipo_id=equipo.id, activo=True, autor_id=autor.id)
        db.add(plan); db.flush()
        tarea_activa = Tarea(nombre="Activo", frecuencia=1, tipo=TipoTarea.OPERACIONAL.value, plan_limpieza_id=plan.id, activo=True)
        tarea_inactiva = Tarea(nombre="Inactiva", frecuencia=1, tipo=TipoTarea.OPERACIONAL.value, plan_limpieza_id=plan.id, activo=False)
        tarea_destino = Tarea(nombre="Destino", frecuencia=1, tipo=TipoTarea.OPERACIONAL.value, plan_limpieza_id=plan.id, activo=True)
        db.add_all([tarea_activa, tarea_inactiva, tarea_destino])
        db.commit()
        tarea_activa_id = tarea_activa.id
        tarea_destino_id = tarea_destino.id

    headers = usuarios["admin"]
    # renombrar a nombre de inactiva -> OK
    resp = client.put(f"/tareas/{tarea_activa_id}", json={"nombre": "Inactiva"}, headers=headers)
    assert resp.status_code == 200
    # renombrar a nombre de activa -> NombreDuplicado
    resp2 = client.put(f"/tareas/{tarea_activa_id}", json={"nombre": "Destino"}, headers=headers)
    assert resp2.status_code == 400
    from src.tareas.constants import ErrorCode
    assert resp2.json()["detail"] == ErrorCode.NOMBRE_DUPLICADO


def test_settings_validation_error():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DB_URL="postgresql://x", SECRET_KEY="x"*40, DB_URL_TEST="sqlite://")


def test_obtener_ip_cliente():
    from src.config import settings
    # mock request
    class Req:
        client = type("obj", (), {"host": "9.9.9.9"})()
        headers = {"X-Forwarded-For": "1.2.3.4, 9.9.9.9"}
    # set settings via monkeypatch? We'll directly test logic by calling function with patched settings
    # Use original settings object but override attributes temporarily
    orig_proxy = settings.TRUSTED_PROXY
    orig_hops = settings.TRUSTED_PROXY_HOPS
    try:
        settings.TRUSTED_PROXY = True
        settings.TRUSTED_PROXY_HOPS = 1
        ip = obtener_ip_cliente(Req())
        assert ip == "9.9.9.9"
        # hops larger than list
        settings.TRUSTED_PROXY_HOPS = 5
        ip2 = obtener_ip_cliente(Req())
        assert ip2 == "9.9.9.9"  # fallback to client.host
        settings.TRUSTED_PROXY = False
        ip3 = obtener_ip_cliente(Req())
        assert ip3 == "9.9.9.9"  # ignores header
    finally:
        settings.TRUSTED_PROXY = orig_proxy
        settings.TRUSTED_PROXY_HOPS = orig_hops


def test_dummy_password_hash():
    assert es_hash_bcrypt(_DUMMY_PASSWORD_HASH)
    assert verificar_password("x", _DUMMY_PASSWORD_HASH) is False
    # should not raise
    try:
        verificar_password("dummy-password", _DUMMY_PASSWORD_HASH)
    except Exception:
        pytest.fail("verificar_password raised")


def test_token_posterior_a_cambio_password():
    now = datetime.utcnow().replace(microsecond=0)
    # En esta versión del helper, un iat del mismo segundo sigue siendo válido
    payload = {"iat": now}
    assert token_posterior_a_cambio_password(payload, now) is True
    # token issued 1 sec before change -> invalid
    payload2 = {"iat": now - timedelta(seconds=1)}
    assert token_posterior_a_cambio_password(payload2, now) is False
    # None values -> valid
    assert token_posterior_a_cambio_password({"iat": None}, now) is True
    assert token_posterior_a_cambio_password(payload, None) is True
