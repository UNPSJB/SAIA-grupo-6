"""Aislamiento entre establecimientos y jerarquía super admin > gerente > admin.

Cada test arma su propia base en memoria con dos sedes: la principal (1) y
"Sede Norte" (2), con datos y usuarios en cada una.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.auditoria.models import AuditLog
from src.auth.services import crear_access_token
from src.database import get_db
from src.establecimientos.contexto import EstablecimientoAjenoError, fijar_establecimiento
from src.establecimientos.models import Establecimiento
from src.Equipo.models import Equipo
from src.main import app
from src.models import ModeloBase
from src.personal.models import Personal
from src.sector.models import Sector

PRINCIPAL, NORTE = 1, 2


@pytest.fixture
def fabrica():
    motor = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(motor, "connect")
    def _fk_on(conexion, _):
        conexion.execute("PRAGMA foreign_keys = ON")

    ModeloBase.metadata.create_all(motor)
    yield sessionmaker(autocommit=False, autoflush=False, bind=motor)
    motor.dispose()


def _persona(db, dni, sede, **roles):
    persona = Personal(
        nombre="Persona", dni=dni, email=f"{dni}@test.local", password="x",
        puede_operar=True, establecimiento_id=sede, **roles,
    )
    db.add(persona)
    return persona


@pytest.fixture
def datos(fabrica):
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        db.add(Establecimiento(id=NORTE, nombre="Sede Norte"))
        db.flush()
        gente = {
            "super": _persona(db, "10000000", None, puede_administrar=True, es_super_admin=True),
            "admin_1": _persona(db, "10000001", PRINCIPAL, puede_administrar=True),
            "gerente_2": _persona(db, "20000000", NORTE, puede_administrar=True, es_gerente=True),
            "admin_2": _persona(db, "20000001", NORTE, puede_administrar=True),
            "operador_2": _persona(db, "20000002", NORTE),
        }
        sector_1 = Sector(nombre="Cocina principal", establecimiento_id=PRINCIPAL)
        sector_2 = Sector(nombre="Cocina norte", establecimiento_id=NORTE)
        db.add_all([sector_1, sector_2])
        db.commit()
        return {
            "ids": {clave: persona.id for clave, persona in gente.items()},
            "sector_1": sector_1.id,
            "sector_2": sector_2.id,
        }


@pytest.fixture
def client(fabrica):
    def _get_db():
        db = fabrica()
        try:
            yield db
        finally:
            db.close()

    anterior = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    try:
        yield TestClient(app)
    finally:
        if anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior


def _h(datos, quien, sede=None):
    token, _, _ = crear_access_token(str(datos["ids"][quien]))
    cabeceras = {"Authorization": f"Bearer {token}"}
    if sede is not None:
        cabeceras["X-Establecimiento-Id"] = str(sede)
    return cabeceras


def _nombres(respuesta):
    assert respuesta.status_code == 200, respuesta.text
    return {fila["nombre"] for fila in respuesta.json()}


# ─────────────────────────── Lectura ───────────────────────────


def test_cada_sede_lista_solo_lo_suyo(client, datos):
    assert _nombres(client.get("/sectores", headers=_h(datos, "admin_2"))) == {"Cocina norte"}
    assert _nombres(client.get("/sectores", headers=_h(datos, "admin_1"))) == {"Cocina principal"}


def test_el_dato_de_otra_sede_no_existe(client, datos):
    cabeceras = _h(datos, "admin_2")
    assert client.get(f"/sectores/{datos['sector_1']}", headers=cabeceras).status_code == 404
    assert client.put(
        f"/sectores/{datos['sector_1']}", json={"nombre": "Robado"}, headers=cabeceras
    ).status_code == 404
    assert client.delete(f"/sectores/{datos['sector_1']}", headers=cabeceras).status_code == 404


def test_la_cabecera_no_cambia_la_sede_de_quien_no_es_super_admin(client, datos):
    cabeceras = _h(datos, "admin_2", sede=PRINCIPAL)
    assert _nombres(client.get("/sectores", headers=cabeceras)) == {"Cocina norte"}


def test_el_super_admin_elige_la_sede_por_cabecera(client, datos):
    assert _nombres(client.get("/sectores", headers=_h(datos, "super"))) == {"Cocina principal"}
    assert _nombres(client.get("/sectores", headers=_h(datos, "super", NORTE))) == {"Cocina norte"}
    assert client.get("/sectores", headers=_h(datos, "super", 99)).status_code == 403


def test_el_personal_de_la_empresa_se_ve_en_todas_las_sedes(client, datos):
    respuesta = client.get("/personal", headers=_h(datos, "gerente_2"))
    assert respuesta.status_code == 200, respuesta.text
    dnis = {fila["dni"] for fila in respuesta.json()}
    assert dnis == {"10000000", "20000000", "20000001", "20000002"}


# ─────────────────────────── Escritura ───────────────────────────


def test_el_alta_queda_en_la_sede_de_quien_la_hace(client, datos, fabrica):
    respuesta = client.post("/sectores", json={"nombre": "Depósito"}, headers=_h(datos, "admin_2"))
    assert respuesta.status_code == 201, respuesta.text
    with fabrica() as db:
        sector = db.get(Sector, respuesta.json()["id"])
        assert sector.establecimiento_id == NORTE
        auditoria = db.scalar(
            select(AuditLog).where(AuditLog.entidad == "sectores", AuditLog.entidad_id == str(sector.id))
        )
        assert auditoria.establecimiento_id == NORTE


def test_no_se_puede_apuntar_a_un_dato_de_otra_sede(client, datos):
    respuesta = client.post(
        "/equipos",
        json={"nombre": "Horno", "sector_id": datos["sector_1"], "tipo": "Horno"},
        headers=_h(datos, "admin_2"),
    )
    # El service ya valida el sector con una consulta filtrada: para la sede
    # Norte, el sector de la principal "no existe".
    assert respuesta.status_code in (400, 404), respuesta.text
    assert "no existe" in respuesta.json()["detail"]


def test_el_orm_rechaza_vincular_o_mover_entre_sedes(fabrica, datos):
    with fabrica() as db:
        fijar_establecimiento(db, NORTE)
        db.add(Equipo(nombre="Horno", sector_id=datos["sector_1"], tipo="Horno"))
        with pytest.raises(EstablecimientoAjenoError):
            db.flush()
        db.rollback()

        fijar_establecimiento(db, NORTE)
        db.add(Sector(nombre="Intruso", establecimiento_id=PRINCIPAL))
        with pytest.raises(EstablecimientoAjenoError):
            db.flush()


def test_un_update_masivo_solo_toca_la_sede_activa(fabrica, datos):
    with fabrica() as db:
        fijar_establecimiento(db, NORTE)
        db.execute(
            update(Sector).values(descripcion="tocado").execution_options(auditoria_omitir=True)
        )
        db.commit()

        fijar_establecimiento(db, None)
        assert db.get(Sector, datos["sector_1"]).descripcion is None
        assert db.get(Sector, datos["sector_2"]).descripcion == "tocado"


# ─────────────────────────── Roles ───────────────────────────


def test_el_gerente_administra_a_los_admins_de_su_sede(client, datos):
    respuesta = client.put(
        f"/personal/{datos['ids']['admin_2']}", json={"nombre": "Ana"}, headers=_h(datos, "gerente_2")
    )
    assert respuesta.status_code == 200, respuesta.text


def test_el_admin_no_toca_al_gerente(client, datos):
    respuesta = client.put(
        f"/personal/{datos['ids']['gerente_2']}", json={"nombre": "X"}, headers=_h(datos, "admin_2")
    )
    assert respuesta.status_code == 403


def test_el_gerente_no_ve_al_personal_de_otra_sede(client, datos):
    respuesta = client.put(
        f"/personal/{datos['ids']['admin_1']}", json={"nombre": "X"}, headers=_h(datos, "gerente_2")
    )
    assert respuesta.status_code == 404


def test_el_gerente_da_de_alta_admins_pero_no_gerentes(client, datos):
    base = {"nombre": "Nuevo", "puede_operar": True, "password": "password123"}
    admin = client.post(
        "/personal",
        json={**base, "dni": "20000010", "email": "n1@test.local", "puede_administrar": True},
        headers=_h(datos, "gerente_2"),
    )
    assert admin.status_code == 200, admin.text
    assert admin.json()["establecimiento_id"] == NORTE

    gerente = client.post(
        "/personal",
        json={**base, "dni": "20000011", "email": "n2@test.local", "es_gerente": True},
        headers=_h(datos, "gerente_2"),
    )
    assert gerente.status_code == 403


def test_el_admin_no_da_de_alta_admins(client, datos):
    respuesta = client.post(
        "/personal",
        json={
            "nombre": "Nuevo", "dni": "20000012", "email": "n3@test.local",
            "puede_operar": True, "puede_administrar": True, "password": "password123",
        },
        headers=_h(datos, "admin_2"),
    )
    assert respuesta.status_code == 403


def test_el_super_admin_crea_gerentes_en_la_sede_elegida(client, datos):
    respuesta = client.post(
        "/personal",
        json={
            "nombre": "Gina", "dni": "20000013", "email": "n4@test.local",
            "es_gerente": True, "password": "password123",
        },
        headers=_h(datos, "super", NORTE),
    )
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["establecimiento_id"] == NORTE
    assert cuerpo["es_gerente"] and cuerpo["puede_administrar"] and cuerpo["puede_operar"]


def test_el_dni_es_unico_en_toda_la_empresa(client, datos):
    respuesta = client.post(
        "/personal",
        json={
            "nombre": "Duplicado", "dni": "10000001", "email": "otro@test.local",
            "puede_operar": True, "password": "password123",
        },
        headers=_h(datos, "gerente_2"),
    )
    assert respuesta.status_code == 400, respuesta.text


# ─────────────────────────── Fase 2: únicos y configuración por sede ───────────────────────────


def test_dos_sedes_pueden_repetir_un_nombre(client, datos):
    # "Cocina principal" existe en la sede 1; la sede Norte puede usarlo igual.
    respuesta = client.post(
        "/sectores", json={"nombre": "Cocina principal"}, headers=_h(datos, "admin_2")
    )
    assert respuesta.status_code == 201, respuesta.text

    # Dentro de la misma sede sigue siendo único.
    repetido = client.post(
        "/sectores", json={"nombre": "Cocina norte"}, headers=_h(datos, "admin_2")
    )
    assert repetido.status_code in (400, 409), repetido.text


def test_cada_sede_tiene_su_configuracion_de_alertas(client, datos):
    cambio = client.put(
        "/configuracion/alertas",
        json={"plazo_reclamo_dias": 99},
        headers=_h(datos, "gerente_2"),
    )
    assert cambio.status_code == 200, cambio.text
    assert cambio.json()["plazo_reclamo_dias"] == 99

    propia = client.get("/configuracion/alertas", headers=_h(datos, "admin_1")).json()
    assert propia["plazo_reclamo_dias"] != 99


def test_el_enlace_publico_dice_de_que_sede_es(client, datos, monkeypatch, fabrica):
    from src.config import settings
    from src.vistaPublica import services as vista

    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "http://saia.test")
    norte = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=_h(datos, "gerente_2")
    )
    principal = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=_h(datos, "admin_1")
    )
    codigo_norte = norte.json()["url_publica"].rsplit("/", 1)[-1]
    codigo_principal = principal.json()["url_publica"].rsplit("/", 1)[-1]
    assert codigo_norte != codigo_principal

    with fabrica() as db:
        assert vista.sede_de_codigo(db, codigo_norte) == NORTE
        assert vista.sede_de_codigo(db, codigo_principal) == PRINCIPAL
        assert vista.sede_de_codigo(db, "inventado") is None

    # Desactivar la de Norte no toca la de la principal.
    client.put(
        "/vista-publica/configuracion", json={"habilitada": False}, headers=_h(datos, "gerente_2")
    )
    assert client.get(f"/vista-publica/publica/{codigo_norte}/indicadores").status_code == 404
    assert client.get(f"/vista-publica/publica/{codigo_principal}/indicadores").status_code == 200


def test_un_archivo_solo_lo_ve_su_sede(client, datos, fabrica, tmp_path, monkeypatch):
    from datetime import date

    from src.Equipo.models import Calibracion
    from src.uploads import router as uploads

    monkeypatch.setattr(uploads, "CARPETA_BASE", tmp_path)
    (tmp_path / "certificados").mkdir()
    (tmp_path / "certificados" / "cal.pdf").write_bytes(b"%PDF-1.4 prueba")

    with fabrica() as db:
        db.info["sin_auditoria"] = True
        equipo = Equipo(nombre="Horno", sector_id=datos["sector_1"], tipo="Horno", establecimiento_id=PRINCIPAL)
        db.add(equipo)
        db.flush()
        db.add(Calibracion(
            equipo_id=equipo.id, fecha_realizacion=date(2026, 1, 1),
            proximo_vencimiento=date(2027, 1, 1), certificado_url="uploads/certificados/cal.pdf",
            establecimiento_id=PRINCIPAL,
        ))
        db.commit()

    assert client.get("/uploads/certificados/cal.pdf", headers=_h(datos, "admin_1")).status_code == 200
    assert client.get("/uploads/certificados/cal.pdf", headers=_h(datos, "admin_2")).status_code == 404


def _plan_en(db, sede, responsable_id, **extra):
    """Un plan de acción en borrador con su situación de origen, en `sede`."""
    from datetime import date

    from src.notificaciones.models import SituacionRiesgo
    from src.planes_accion.models import PlanAccion, SituacionPlan

    situacion = SituacionRiesgo(
        tipo="PLAN_CALIBRACION_VENCIDO", clave=f"calib-{sede}", elemento="equipo:1",
        detectada_en=date(2026, 1, 1), establecimiento_id=sede,
    )
    db.add(situacion)
    db.flush()
    plan = PlanAccion(
        tipo=situacion.tipo, estado="borrador", situacion_origen_id=situacion.id,
        causa="Causa", objetivo="Objetivo", criterio_eficacia="Criterio",
        responsable_id=responsable_id, creado_por_id=responsable_id,
        dias_observacion=30, establecimiento_id=sede, **extra,
    )
    plan.situaciones.append(
        SituacionPlan(
            situacion_id=situacion.id, es_origen=True, agregada_en=date(2026, 1, 1),
            establecimiento_id=sede,
        )
    )
    db.add(plan)
    db.flush()
    return plan


def test_un_plan_de_accion_solo_lo_ve_su_sede(client, datos, fabrica):
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        plan_1 = _plan_en(db, PRINCIPAL, datos["ids"]["admin_1"])
        db.commit()
        plan_id = plan_1.id

    def listado(quien):
        respuesta = client.get("/planes-accion", headers=_h(datos, quien))
        assert respuesta.status_code == 200, respuesta.text
        cuerpo = respuesta.json()
        return [p["id"] for p in (cuerpo["items"] if isinstance(cuerpo, dict) else cuerpo)]

    assert listado("admin_1") == [plan_id]
    assert listado("admin_2") == []
    assert client.get(f"/planes-accion/{plan_id}", headers=_h(datos, "admin_1")).status_code == 200
    assert client.get(f"/planes-accion/{plan_id}", headers=_h(datos, "admin_2")).status_code == 404


def test_cada_sede_tiene_su_periodo_de_observacion(fabrica, datos):
    from src.planes_accion import services

    tipo = "PLAN_CALIBRACION_VENCIDO"
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        fijar_establecimiento(db, PRINCIPAL)
        services.fijar_observacion(db, tipo, 60)
        fijar_establecimiento(db, NORTE)
        services.fijar_observacion(db, tipo, 45)
        assert services.dias_observacion_de(db, tipo) == 45
        fijar_establecimiento(db, PRINCIPAL)
        assert services.dias_observacion_de(db, tipo) == 60


def test_la_evidencia_de_un_plan_solo_la_ve_su_sede(client, datos, fabrica, tmp_path, monkeypatch):
    from src.planes_accion.models import EvidenciaPlan
    from src.uploads import router as uploads

    monkeypatch.setattr(uploads, "CARPETA_BASE", tmp_path)
    (tmp_path / "planes_accion").mkdir()
    (tmp_path / "planes_accion" / "ev.pdf").write_bytes(b"%PDF-1.4 prueba")
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        plan = _plan_en(db, PRINCIPAL, datos["ids"]["admin_1"])
        db.add(EvidenciaPlan(
            plan_id=plan.id, tipo="implementacion", descripcion="Foto",
            archivo_url="uploads/planes_accion/ev.pdf", establecimiento_id=PRINCIPAL,
        ))
        db.commit()

    ruta = "/uploads/planes_accion/ev.pdf"
    assert client.get(ruta, headers=_h(datos, "admin_1")).status_code == 200
    assert client.get(ruta, headers=_h(datos, "admin_2")).status_code == 404


def test_un_cambio_ensucia_solo_las_notificaciones_de_su_sede(fabrica, datos):
    from src.notificaciones.invalidacion import EstadoNotificaciones, registrar_invalidacion_automatica

    registrar_invalidacion_automatica()
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        db.add_all([
            EstadoNotificaciones(establecimiento_id=PRINCIPAL, sucio=False, version=0),
            EstadoNotificaciones(establecimiento_id=NORTE, sucio=False, version=0),
        ])
        db.commit()

        fijar_establecimiento(db, NORTE)
        db.add(Equipo(nombre="Heladera", sector_id=datos["sector_2"], tipo="Frío"))
        db.commit()

        fijar_establecimiento(db, None)
        db.expire_all()
        assert db.get(EstadoNotificaciones, NORTE).sucio is True
        assert db.get(EstadoNotificaciones, PRINCIPAL).sucio is False


# ─────────────────────────── Fase 3: alta de establecimientos ───────────────────────────


def test_solo_el_super_admin_crea_establecimientos(client, datos):
    nuevo = client.post(
        "/establecimientos", json={"nombre": "Sede Sur", "direccion": "Ruta 3"}, headers=_h(datos, "super")
    )
    assert nuevo.status_code == 201, nuevo.text
    assert nuevo.json()["personal_activo"] == 0

    assert client.post(
        "/establecimientos", json={"nombre": "Otra"}, headers=_h(datos, "gerente_2")
    ).status_code == 403
    repetido = client.post(
        "/establecimientos", json={"nombre": "sede sur"}, headers=_h(datos, "super")
    )
    assert repetido.status_code == 400


def test_quien_ve_que_establecimientos(client, datos):
    todos = client.get("/establecimientos", headers=_h(datos, "gerente_2")).json()
    assert {e["nombre"] for e in todos} == {"Establecimiento principal", "Sede Norte"}
    propio = client.get("/establecimientos", headers=_h(datos, "admin_2")).json()
    assert [e["nombre"] for e in propio] == ["Sede Norte"]
    norte = next(e for e in todos if e["id"] == NORTE)
    assert norte["personal_activo"] == 3

    actual = client.get("/establecimientos/actual", headers=_h(datos, "super", NORTE)).json()
    assert actual["id"] == NORTE


def test_dar_de_baja_una_sede_corta_el_acceso_de_su_personal(client, datos):
    baja = client.put(f"/establecimientos/{NORTE}", json={"activo": False}, headers=_h(datos, "super"))
    assert baja.status_code == 200, baja.text
    assert client.get("/sectores", headers=_h(datos, "admin_2")).status_code == 403
    # El super admin tampoco puede elegirla mientras esté de baja.
    assert client.get("/sectores", headers=_h(datos, "super", NORTE)).status_code == 403

    principal = client.put(f"/establecimientos/{PRINCIPAL}", json={"activo": False}, headers=_h(datos, "super"))
    assert principal.status_code == 400


# ─────────────────────────── Fase 4: tablero comparativo ───────────────────────────


def test_el_tablero_compara_cada_sede_con_la_empresa(client, datos, fabrica):
    from datetime import date, timedelta

    from src.aptitud.models import Aptitud
    from src.vencimientoPersonal.models import VencimientoPersonal

    hoy_dia = date.today()
    with fabrica() as db:
        db.info["sin_auditoria"] = True
        for sede, persona_a, persona_b in (
            (NORTE, "admin_2", "operador_2"),
            (PRINCIPAL, "admin_1", None),
        ):
            aptitud = Aptitud(nombre=f"Libreta {sede}", establecimiento_id=sede)
            db.add(aptitud)
            db.flush()
            # Norte: una vigente y una vencida (50 %). Principal: una vigente (100 %).
            db.add(VencimientoPersonal(
                persona_id=datos["ids"][persona_a], aptitud_id=aptitud.id,
                fecha_vencimiento=hoy_dia + timedelta(days=30), establecimiento_id=sede,
            ))
            if persona_b:
                db.add(VencimientoPersonal(
                    persona_id=datos["ids"][persona_b], aptitud_id=aptitud.id,
                    fecha_vencimiento=hoy_dia - timedelta(days=1), establecimiento_id=sede,
                ))
        db.commit()

    desde, hasta = hoy_dia - timedelta(days=29), hoy_dia
    respuesta = client.get(
        f"/paneles/comparativo?desde={desde}&hasta={hasta}", headers=_h(datos, "gerente_2")
    )
    assert respuesta.status_code == 200, respuesta.text
    tablero = respuesta.json()
    assert tablero["establecimiento_propio_id"] == NORTE
    assert {s["nombre"] for s in tablero["establecimientos"]} == {"Establecimiento principal", "Sede Norte"}

    aptitudes = next(i for i in tablero["indicadores"] if i["clave"] == "personal_apto")
    por_sede = {v["establecimiento_id"]: v["valor"] for v in aptitudes["valores"]}
    assert por_sede == {PRINCIPAL: 100.0, NORTE: 50.0}
    assert aptitudes["promedio_empresa"] == 75.0
    assert aptitudes["valor_propio"] == 50.0
    assert aptitudes["posicion_propia"] == 2

    # Después del tablero, la sesión sigue en la sede del gerente.
    assert _nombres(client.get("/sectores", headers=_h(datos, "gerente_2"))) == {"Cocina norte"}


def test_el_tablero_es_solo_para_gerentes_y_super_admin(client, datos):
    url = "/paneles/comparativo?desde=2026-01-01&hasta=2026-01-31"
    assert client.get(url, headers=_h(datos, "admin_2")).status_code == 403
    assert client.get(url, headers=_h(datos, "super", NORTE)).json()["establecimiento_propio_id"] == NORTE


def test_ver_dados_de_baja_trae_solo_los_dados_de_baja(client, datos, fabrica):
    from src.clientes.models import Cliente
    from src.transportistas.models import Transportista

    with fabrica() as db:
        db.info["sin_auditoria"] = True
        db.add_all([
            Cliente(nombre="Activo SA", documento="30111111111", telefono="3511111111", activo=True, establecimiento_id=NORTE),
            Cliente(nombre="Baja SRL", documento="30222222222", telefono="3512222222", activo=False, establecimiento_id=NORTE),
            Transportista(razon_social="Fletes Activos", cuit="20111111112", telefono="3513333333", activo=True, establecimiento_id=NORTE),
            Transportista(razon_social="Fletes Baja", cuit="20222222223", telefono="3514444444", activo=False, establecimiento_id=NORTE),
        ])
        db.commit()

    h = _h(datos, "admin_2")
    bajas = client.get("/clientes?solo_inactivos=true&page=1", headers=h).json()["items"]
    assert [c["nombre"] for c in bajas] == ["Baja SRL"]
    activos = client.get("/clientes?page=1", headers=h).json()["items"]
    assert [c["nombre"] for c in activos] == ["Activo SA"]
    bajas_t = client.get("/transportistas?solo_inactivos=true&page=1", headers=h).json()["items"]
    assert [t["razon_social"] for t in bajas_t] == ["Fletes Baja"]
