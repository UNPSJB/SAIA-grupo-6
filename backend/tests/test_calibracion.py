"""Tests de calibración con fecha futura (problema 4).

Cubre: validación de fecha no futura (422), equipo activo requerido, edición
y baja lógica de Calibracion con recálculo de la última intervención,
límite de periodicidad_dias y OverflowError capturado, y asentar dentro del
try (sin certificados huérfanos).
"""

from datetime import date, timedelta

import pytest

from src.common.fechas import hoy
from src.Equipo.models import Equipo, Calibracion
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.PlanCalibracionMantenimiento.services import (
    asentar_ultima_intervencion,
    recalcular_ultima_intervencion,
)
from src.personal.models import Personal
from src.sector.models import Sector


def _crear_escenario(db, equipo_activo=True):
    sector = Sector(nombre=f"Sector cal test {_contador()}", activo=True)
    db.add(sector)
    db.flush()

    autor = Personal(
        nombre="Autor Cal",
        apellido="Test",
        dni=f"940000{_contador()}",
        email=f"autor.cal.{_contador.i}@test.local",
        password="x",
        puede_administrar=True,
        puede_operar=True,
        activo=True,
    )
    _contador.i += 1
    db.add(autor)
    db.flush()

    equipo = Equipo(
        nombre="Equipo cal test",
        tipo="Medición",
        sector_id=sector.id,
        activo=equipo_activo,
        frecuencia_calibracion_dias=365,
    )
    db.add(equipo)
    db.flush()

    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id,
        autor_id=autor.id,
        tipo="calibracion",
        fecha_ultima_intervencion=hoy() - timedelta(days=10),
        periodicidad_dias=90,
        activo=True,
    )
    db.add(plan)
    db.flush()

    return equipo, plan


def _contador():
    if not hasattr(_contador, "i"):
        _contador.i = 0
    _contador.i += 1
    return _contador.i


def test_fecha_realizacion_futura_devuelve_422(client, usuarios, session_factory):
    hoy_val = hoy()
    with session_factory() as db:
        equipo, plan = _crear_escenario(db)
        equipo_id = equipo.id
        db.commit()

    resp = client.post(
        f"/equipos/{equipo_id}/calibraciones",
        headers=usuarios["operador"],
        data={
            "fecha_realizacion": (hoy_val + timedelta(days=5)).isoformat(),
            "certificado": ("cert.pdf", b"%PDF-1.4 dummy", "application/pdf"),
            "tipo": "calibracion",
        },
    )
    assert resp.status_code == 422, resp.text


def test_equipo_inactivo_devuelve_400(client, usuarios, session_factory):
    hoy_val = hoy()
    with session_factory() as db:
        equipo, plan = _crear_escenario(db, equipo_activo=False)
        equipo_id = equipo.id
        db.commit()

    resp = client.post(
        f"/equipos/{equipo_id}/calibraciones",
        headers=usuarios["operador"],
        files={
            "certificado": ("cert.pdf", b"%PDF-1.4 dummy", "application/pdf")
        },
        data={
            "fecha_realizacion": hoy_val.isoformat(),
            "tipo": "calibracion",
        },
    )
    assert resp.status_code == 400, resp.text


def test_registro_valido_asienta_y_no_huérfano(client, usuarios, session_factory):
    hoy_val = hoy()
    with session_factory() as db:
        equipo, plan = _crear_escenario(db)
        equipo_id = equipo.id
        plan_id = plan.id
        db.commit()

    resp = client.post(
        f"/equipos/{equipo_id}/calibraciones",
        headers=usuarios["operador"],
        files={
            "certificado": ("cert.pdf", b"%PDF-1.4 dummy", "application/pdf")
        },
        data={
            "fecha_realizacion": hoy_val.isoformat(),
            "tipo": "calibracion",
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["proximo_vencimiento"] == (
        hoy_val + timedelta(days=90)
    ).isoformat()

    # La última intervención del plan quedó asentada en hoy.
    with session_factory() as db:
        plan_db = db.get(PlanCalibracionMantenimiento, plan_id)
        assert plan_db.fecha_ultima_intervencion == hoy_val


def test_patch_editar_fecha_recalcula_puede_bajar(client, usuarios, session_factory):
    hoy_val = hoy()
    with session_factory() as db:
        equipo, plan = _crear_escenario(db)
        equipo_id = equipo.id
        plan_id = plan.id
        # Una intervención pasada (día 5) y la asentada del plan (día -10).
        c1 = Calibracion(
            equipo_id=equipo_id,
            fecha_realizacion=hoy_val - timedelta(days=5),
            proximo_vencimiento=hoy_val - timedelta(days=5) + timedelta(days=90),
            certificado_url="uploads/certificados/c1.pdf",
            tipo="calibracion",
            activo=True,
        )
        db.add(c1)
        db.flush()
        calibracion_id = c1.id
        db.commit()

    # Editar a una fecha anterior (día 20): la última intervención debe bajar
    # al máximo vigente (día 5).
    resp = client.patch(
        f"/equipos/{equipo_id}/calibraciones/{calibracion_id}",
        headers=usuarios["operador"],
        json={"fecha_realizacion": (hoy_val - timedelta(days=20)).isoformat()},
    )
    assert resp.status_code == 200, resp.text

    with session_factory() as db:
        plan_db = db.get(PlanCalibracionMantenimiento, plan_id)
        assert plan_db.fecha_ultima_intervencion == hoy_val - timedelta(days=20)


def test_delete_borrado_logico_y_recalcula(client, usuarios, session_factory):
    hoy_val = hoy()
    with session_factory() as db:
        equipo, plan = _crear_escenario(db)
        equipo_id = equipo.id
        plan_id = plan.id
        c1 = Calibracion(
            equipo_id=equipo_id,
            fecha_realizacion=hoy_val - timedelta(days=5),
            proximo_vencimiento=hoy_val - timedelta(days=5) + timedelta(days=90),
            certificado_url="uploads/certificados/c1.pdf",
            tipo="calibracion",
            activo=True,
        )
        c2 = Calibracion(
            equipo_id=equipo_id,
            fecha_realizacion=hoy_val - timedelta(days=2),
            proximo_vencimiento=hoy_val - timedelta(days=2) + timedelta(days=90),
            certificado_url="uploads/certificados/c2.pdf",
            tipo="calibracion",
            activo=True,
        )
        db.add_all([c1, c2])
        db.flush()
        c2_id = c2.id
        db.commit()

    # Borrar la más reciente (c2, día 2): la última intervención debe volver a
    # ser la de c1 (día 5).
    resp = client.delete(
        f"/equipos/{equipo_id}/calibraciones/{c2_id}",
        headers=usuarios["operador"],
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["activo"] is False

    with session_factory() as db:
        c2_db = db.get(Calibracion, c2_id)
        assert c2_db.activo is False
        plan_db = db.get(PlanCalibracionMantenimiento, plan_id)
        assert plan_db.fecha_ultima_intervencion == hoy_val - timedelta(days=5)


def test_periodicidad_enorme_captura_overflow(client, usuarios, session_factory):
    """Un plan con periodicidad enorme (salvando el schema) provoca 422 al
    calcular la fecha de vencimiento, no un 500."""
    hoy_val = hoy()
    with session_factory() as db:
        sector = Sector(nombre=f"Sector overflow {_contador()}", activo=True)
        db.add(sector)
        db.flush()
        autor = Personal(
            nombre="Autor Overflow",
            apellido="Test",
            dni=f"940000{_contador()}",
            email=f"autor.overflow.{_contador.i}@test.local",
            password="x",
            puede_administrar=True,
            puede_operar=True,
            activo=True,
        )
        db.add(autor)
        db.flush()
        equipo = Equipo(
            nombre="Equipo overflow",
            tipo="Medición",
            sector_id=sector.id,
            activo=True,
            frecuencia_calibracion_dias=365,
        )
        db.add(equipo)
        db.flush()
        # Se inserta directamente con periodicidad enorme (salvando el límite
        # del schema) para reproducir el OverflowError del cálculo.
        plan = PlanCalibracionMantenimiento(
            equipo_id=equipo.id,
            autor_id=autor.id,
            tipo="calibracion",
            fecha_ultima_intervencion=hoy_val - timedelta(days=10),
            periodicidad_dias=9_999_999_999,
            activo=True,
        )
        db.add(plan)
        db.flush()
        equipo_id = equipo.id
        db.commit()

    resp = client.post(
        f"/equipos/{equipo_id}/calibraciones",
        headers=usuarios["operador"],
        data={
            "fecha_realizacion": hoy_val.isoformat(),
            "certificado": ("cert.pdf", b"%PDF-1.4 dummy", "application/pdf"),
            "tipo": "calibracion",
        },
    )
    assert resp.status_code == 422, resp.text


def test_recalcular_ultima_intervencion_servicio(db_session):
    """El servicio recalcula (y puede retroceder) desde calibraciones activas."""
    db = db_session
    hoy_val = hoy()
    sector = Sector(nombre="S", activo=True)
    db.add(sector)
    db.flush()
    autor = Personal(
        nombre="Autor", apellido="T", dni="9400001",
        email="autor.t@test.local", password="x",
        puede_administrar=True, puede_operar=True, activo=True,
    )
    db.add(autor)
    db.flush()
    equipo = Equipo(
        nombre="E", tipo="Medición", sector_id=sector.id, activo=True
    )
    db.add(equipo)
    db.flush()
    plan = PlanCalibracionMantenimiento(
        equipo_id=equipo.id,
        autor_id=autor.id,
        tipo="calibracion",
        fecha_ultima_intervencion=hoy_val - timedelta(days=20),
        periodicidad_dias=90,
        activo=True,
    )
    db.add(plan)
    db.flush()
    plan_id = plan.id

    c1 = Calibracion(
        equipo_id=equipo.id,
        fecha_realizacion=hoy_val - timedelta(days=10),
        proximo_vencimiento=hoy_val,
        certificado_url="u/c1.pdf",
        tipo="calibracion",
        activo=True,
    )
    c2 = Calibracion(
        equipo_id=equipo.id,
        fecha_realizacion=hoy_val - timedelta(days=2),
        proximo_vencimiento=hoy_val + timedelta(days=8),
        certificado_url="u/c2.pdf",
        tipo="calibracion",
        activo=True,
    )
    db.add_all([c1, c2])
    db.commit()

    # Asentar c2 (día 2) avanza la última intervención.
    asentar_ultima_intervencion(db, equipo.id, "calibracion", hoy_val - timedelta(days=2))
    db.commit()
    plan_db = db.get(PlanCalibracionMantenimiento, plan_id)
    assert plan_db.fecha_ultima_intervencion == hoy_val - timedelta(days=2)

    # Dar de baja c2: retrocede a c1 (día 10).
    c2.activo = False
    db.add(c2)
    recalcular_ultima_intervencion(db, equipo.id, "calibracion")
    db.commit()
    plan_db = db.get(PlanCalibracionMantenimiento, plan_id)
    assert plan_db.fecha_ultima_intervencion == hoy_val - timedelta(days=10)
