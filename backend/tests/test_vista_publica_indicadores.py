from collections.abc import Generator
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.aptitud.models import Aptitud
from src.auth.services import crear_access_token
from src.checklist.models import Checklist, EstadoChecklist, RegistroTarea
from src.common.fechas import hoy
from src.config import settings
from src.database import get_db
from src.documentos.models import Documento, VersionDocumento
from src.elementoLimpieza.models import ElementoLimpieza
from src.Equipo.models import Equipo
from src.main import app
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.PlanLimpieza.models import PlanLimpieza
from src.sector.models import Sector
from src.vencimientoPersonal.models import VencimientoPersonal
from src.vistaPublica.models import IndicadorVistaPublica


def _headers(usuario_id: int) -> dict[str, str]:
    token, _, _ = crear_access_token(str(usuario_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def cliente_indicadores(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> Generator[tuple[TestClient, Session, dict[str, str], dict[str, str]], None, None]:
    admin = Personal(
        nombre="Ada",
        apellido="Administradora",
        dni="31888111",
        email="indicadores-admin@test.local",
        password="hash",
        puede_operar=True,
        puede_administrar=True,
    )
    operador = Personal(
        nombre="Omar",
        apellido="Operador",
        dni="31888222",
        email="indicadores-operador@test.local",
        password="hash",
        puede_operar=True,
        puede_administrar=False,
    )
    db_session.add_all([admin, operador])
    db_session.commit()

    def _get_db() -> Generator[Session, None, None]:
        yield db_session

    anterior = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://saia.test/app")
    try:
        client = TestClient(app)
        yield client, db_session, _headers(admin.id), _headers(operador.id)
        client.close()
    finally:
        if anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior


def _activar(client: TestClient, admin: dict[str, str]) -> str:
    respuesta = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    assert respuesta.status_code == 200
    return respuesta.json()["url_publica"].rsplit("/", 1)[1]


def _habilitar_todos(client: TestClient, admin: dict[str, str]) -> None:
    catalogo = client.get("/vista-publica/indicadores", headers=admin).json()
    respuesta = client.put(
        "/vista-publica/indicadores",
        json={
            "indicadores": [
                {"clave": item["clave"], "habilitado": True}
                for item in catalogo["indicadores"]
            ]
        },
        headers=admin,
    )
    assert respuesta.status_code == 200


def _admin_id(db: Session) -> int:
    return db.query(Personal).filter(Personal.dni == "31888111").one().id


def _crear_equipo(db: Session, nombre: str) -> Equipo:
    sector = db.query(Sector).filter(Sector.nombre == "Cocina").first()
    if sector is None:
        sector = Sector(nombre="Cocina", activo=True)
        db.add(sector)
        db.flush()
    equipo = Equipo(nombre=nombre, tipo="frío", sector_id=sector.id, activo=True)
    db.add(equipo)
    db.flush()
    return equipo


def _plan_equipo(
    db: Session, equipo: Equipo, tipo: str, dias_desde_intervencion: int
) -> None:
    """Plan de 30 días: vigente si la última intervención fue hace < 30 días."""
    db.add(
        PlanCalibracionMantenimiento(
            equipo_id=equipo.id,
            autor_id=_admin_id(db),
            tipo=tipo,
            fecha_ultima_intervencion=hoy() - timedelta(days=dias_desde_intervencion),
            periodicidad_dias=30,
            activo=True,
        )
    )


def _registrar_limpieza(
    db: Session,
    equipo: Equipo,
    plan: PlanLimpieza,
    dias_atras: int,
    completadas: int,
    total: int,
) -> None:
    """Un checklist de `dias_atras` días con `completadas` de `total` tareas."""
    checklist = Checklist(
        equipo_id=equipo.id,
        plan_id=plan.id,
        fecha=hoy() - timedelta(days=dias_atras),
        estado=EstadoChecklist.ABIERTO,
    )
    db.add(checklist)
    db.flush()
    db.add_all(
        RegistroTarea(
            checklist_id=checklist.id,
            nombre_tarea_historico=f"Tarea {indice}",
            completado=indice < completadas,
        )
        for indice in range(total)
    )


def _plan_limpieza(db: Session, equipo: Equipo) -> PlanLimpieza:
    plan = PlanLimpieza(
        nombre=f"Plan {equipo.nombre}",
        equipo_id=equipo.id,
        autor_id=_admin_id(db),
        activo=True,
    )
    db.add(plan)
    db.flush()
    return plan


def _personas_con_aptitud(db: Session, cantidad: int, aptitud: Aptitud) -> None:
    """`cantidad` personas activas, cada una con un vencimiento vigente."""
    existentes = db.query(Personal).filter(Personal.dni.like("3199%")).count()
    for indice in range(existentes, existentes + cantidad):
        persona = Personal(
            nombre=f"Persona{indice}",
            apellido="Prueba",
            dni=f"3199{indice:04d}",
            email=f"persona{indice}@test.local",
            password="hash",
            puede_operar=True,
            puede_administrar=False,
        )
        db.add(persona)
        db.flush()
        db.add(
            VencimientoPersonal(
                persona_id=persona.id,
                aptitud_id=aptitud.id,
                fecha_vencimiento=hoy() + timedelta(days=30),
                activo=True,
            )
        )


def _valores_publicos(client: TestClient, codigo: str) -> dict[str, dict]:
    respuesta = client.get(f"/vista-publica/publica/{codigo}/indicadores")
    assert respuesta.status_code == 200
    return {item["clave"]: item for item in respuesta.json()["indicadores"]}


def test_catalogo_inicial_sin_incidentes_y_con_defaults(
    cliente_indicadores,
):
    client, _, admin, _ = cliente_indicadores

    respuesta = client.get("/vista-publica/indicadores", headers=admin)

    assert respuesta.status_code == 200
    indicadores = respuesta.json()["indicadores"]
    claves = {item["clave"] for item in indicadores}
    assert "incidentes" not in " ".join(claves)
    assert all(item["disponible"] for item in indicadores)
    # La vista pública nunca expone detalle de incidentes ni no conformidades.
    assert not any("incidente" in item["etiqueta"].lower() for item in indicadores)
    assert not any("no conformidad" in item["etiqueta"].lower() for item in indicadores)

    por_clave = {item["clave"]: item for item in indicadores}
    assert por_clave["cumplimiento_poes"]["habilitado"] is False
    assert por_clave["equipos_al_dia"]["habilitado"] is True
    assert por_clave["personal_apto"]["habilitado"] is True
    assert por_clave["documentos_vigentes"]["etiqueta"] == "Documentación al día"
    assert por_clave["elementos_al_dia"]["habilitado"] is True
    # Base vacía: ningún indicador tiene datos, pero el admin ve el catálogo.
    assert all(item["con_datos"] is False for item in indicadores)

    # Calibración y mantenimiento se fusionaron en un solo indicador, y el
    # stock (dato operativo interno) ya no se ofrece para publicar.
    assert set(por_clave) == {
        "cumplimiento_poes",
        "equipos_al_dia",
        "personal_apto",
        "documentos_vigentes",
        "elementos_al_dia",
    }


def test_solo_admin_puede_consultar_y_modificar_indicadores(cliente_indicadores):
    client, _, _, operador = cliente_indicadores
    cuerpo = {"indicadores": [{"clave": "cumplimiento_poes", "habilitado": False}]}

    assert client.get("/vista-publica/indicadores").status_code == 401
    assert client.put("/vista-publica/indicadores", json=cuerpo).status_code == 401
    assert client.get("/vista-publica/indicadores", headers=operador).status_code == 403
    assert (
        client.put(
            "/vista-publica/indicadores", json=cuerpo, headers=operador
        ).status_code
        == 403
    )


def test_actualizar_persiste_y_rechaza_claves_fuera_del_catalogo(
    cliente_indicadores,
):
    client, db, admin, _ = cliente_indicadores

    respuesta = client.put(
        "/vista-publica/indicadores",
        json={
            "indicadores": [
                {"clave": "cumplimiento_poes", "habilitado": True},
                {"clave": "elementos_al_dia", "habilitado": False},
            ]
        },
        headers=admin,
    )

    assert respuesta.status_code == 200
    por_clave = {item["clave"]: item for item in respuesta.json()["indicadores"]}
    assert por_clave["cumplimiento_poes"]["habilitado"] is True
    assert por_clave["elementos_al_dia"]["habilitado"] is False

    db.expire_all()
    guardados = {
        fila.clave: fila.habilitado
        for fila in db.query(IndicadorVistaPublica).all()
    }
    assert guardados == {
        "cumplimiento_poes": True,
        "elementos_al_dia": False,
    }

    invalida = client.put(
        "/vista-publica/indicadores",
        json={"indicadores": [{"clave": "incidentes_por_tipo", "habilitado": True}]},
        headers=admin,
    )
    assert invalida.status_code == 422
    assert "incidentes_por_tipo" in invalida.json()["detail"]

    # Las claves retiradas del catálogo tampoco se pueden volver a habilitar.
    for retirada in ("stock_suficiente", "equipos_calibrados", "equipos_mantenimiento"):
        rechazada = client.put(
            "/vista-publica/indicadores",
            json={"indicadores": [{"clave": retirada, "habilitado": True}]},
            headers=admin,
        )
        assert rechazada.status_code == 422


def test_publico_devuelve_solo_habilitados_y_sin_cache(cliente_indicadores):
    client, db, admin, _ = cliente_indicadores

    # Los indicadores sin datos no se publican, así que se siembra lo mínimo
    # para que equipos y limpieza tengan algo que medir.
    db.info["sin_auditoria"] = True
    try:
        equipo = _crear_equipo(db, "Heladera")
        _plan_equipo(db, equipo, "calibracion", dias_desde_intervencion=5)
        _registrar_limpieza(
            db, equipo, _plan_limpieza(db, equipo), 0, completadas=1, total=1
        )
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    codigo = _activar(client, admin)

    # Por defecto, los indicadores seguros; la limpieza queda apagada.
    publicos = client.get(f"/vista-publica/publica/{codigo}/indicadores")
    assert publicos.status_code == 200
    assert publicos.headers["cache-control"] == "no-store, max-age=0"
    claves = {item["clave"] for item in publicos.json()["indicadores"]}
    assert "cumplimiento_poes" not in claves
    assert "equipos_al_dia" in claves

    # Un cambio del admin se refleja en la consulta siguiente, sin reiniciar.
    client.put(
        "/vista-publica/indicadores",
        json={
            "indicadores": [
                {"clave": "cumplimiento_poes", "habilitado": True},
                {"clave": "equipos_al_dia", "habilitado": False},
            ]
        },
        headers=admin,
    )
    despues = client.get(f"/vista-publica/publica/{codigo}/indicadores")
    assert despues.status_code == 200
    claves_despues = {item["clave"] for item in despues.json()["indicadores"]}
    assert "cumplimiento_poes" in claves_despues
    assert "equipos_al_dia" not in claves_despues

    # Sin código vigente no se revela ni el catálogo ni la configuración.
    invalida = client.get("/vista-publica/publica/codigo-invalido/indicadores")
    assert invalida.status_code == 404
    assert invalida.headers["cache-control"] == "no-store, max-age=0"
    assert "codigo_publico" not in invalida.text


def test_calcula_porcentajes_agregados_con_datos_reales(cliente_indicadores):
    client, db, admin, _ = cliente_indicadores
    hoy_dia = hoy()

    db.info["sin_auditoria"] = True
    try:
        sector = Sector(nombre="Cocina", activo=True)
        db.add(sector)
        db.flush()

        admin_id = db.query(Personal).filter(Personal.dni == "31888111").one().id

        # 2 equipos con plan de calibración: uno vigente, uno vencido.
        equipos = [
            Equipo(nombre="Heladera", tipo="frío", sector_id=sector.id, activo=True),
            Equipo(nombre="Horno", tipo="calor", sector_id=sector.id, activo=True),
        ]
        db.add_all(equipos)
        db.flush()
        db.add_all(
            [
                PlanCalibracionMantenimiento(
                    equipo_id=equipos[0].id,
                    autor_id=admin_id,
                    tipo="calibracion",
                    fecha_ultima_intervencion=hoy_dia - timedelta(days=5),
                    periodicidad_dias=30,
                    activo=True,
                ),
                PlanCalibracionMantenimiento(
                    equipo_id=equipos[1].id,
                    autor_id=admin_id,
                    tipo="calibracion",
                    fecha_ultima_intervencion=hoy_dia - timedelta(days=60),
                    periodicidad_dias=30,
                    activo=True,
                ),
            ]
        )

        # 5 personas (el mínimo para publicar), cada una con 2 vencimientos:
        # uno vigente y uno vencido, es decir 5 de 10 al día.
        aptitudes = [Aptitud(nombre="Carnet"), Aptitud(nombre="Apto físico")]
        db.add_all(aptitudes)
        db.flush()
        personas = [db.get(Personal, admin_id)]
        for indice in range(4):
            persona = Personal(
                nombre=f"Persona{indice}",
                apellido="Prueba",
                dni=f"3199000{indice}",
                email=f"persona{indice}@test.local",
                password="hash",
                puede_operar=True,
                puede_administrar=False,
            )
            db.add(persona)
            personas.append(persona)
        db.flush()
        for persona in personas:
            db.add_all(
                [
                    VencimientoPersonal(
                        persona_id=persona.id,
                        aptitud_id=aptitudes[0].id,
                        fecha_vencimiento=hoy_dia + timedelta(days=30),
                        activo=True,
                    ),
                    VencimientoPersonal(
                        persona_id=persona.id,
                        aptitud_id=aptitudes[1].id,
                        fecha_vencimiento=hoy_dia - timedelta(days=1),
                        activo=True,
                    ),
                ]
            )

        # 2 documentos: uno vigente sin vencer, uno vigente pero vencido.
        documentos = [
            Documento(nombre="Manual BPM", tipo="manual_bpm"),
            Documento(nombre="Procedimiento", tipo="procedimiento"),
        ]
        db.add_all(documentos)
        db.flush()
        db.add_all(
            [
                VersionDocumento(
                    documento_id=documentos[0].id,
                    numero_version=1,
                    nombre_archivo="manual.pdf",
                    archivo_url="documentos/manual.pdf",
                    vigente=True,
                    fecha_vencimiento=None,
                    autor_id=admin_id,
                ),
                VersionDocumento(
                    documento_id=documentos[1].id,
                    numero_version=1,
                    nombre_archivo="procedimiento.pdf",
                    archivo_url="documentos/procedimiento.pdf",
                    vigente=True,
                    fecha_vencimiento=hoy_dia - timedelta(days=1),
                    autor_id=admin_id,
                ),
            ]
        )

        # 2 elementos: uno con recambio al día, uno atrasado.
        db.add_all(
            [
                ElementoLimpieza(
                    nombre="Cepillo",
                    frecuencia_recambio_dias=10,
                    fecha_ultimo_recambio=hoy_dia - timedelta(days=5),
                    activo=True,
                ),
                ElementoLimpieza(
                    nombre="Trapo",
                    frecuencia_recambio_dias=10,
                    fecha_ultimo_recambio=hoy_dia - timedelta(days=20),
                    activo=True,
                ),
            ]
        )

        # 2 tareas de limpieza: una completada y una pendiente.
        plan = PlanLimpieza(
            nombre="Plan diario",
            equipo_id=equipos[0].id,
            autor_id=admin_id,
            activo=True,
        )
        db.add(plan)
        db.flush()
        checklist = Checklist(
            equipo_id=equipos[0].id,
            plan_id=plan.id,
            fecha=hoy_dia,
            estado=EstadoChecklist.ABIERTO,
        )
        db.add(checklist)
        db.flush()
        db.add_all(
            [
                RegistroTarea(
                    checklist_id=checklist.id,
                    nombre_tarea_historico="Limpiar heladera",
                    completado=True,
                ),
                RegistroTarea(
                    checklist_id=checklist.id,
                    nombre_tarea_historico="Limpiar horno",
                    completado=False,
                ),
            ]
        )
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    _habilitar_todos(client, admin)
    codigo = _activar(client, admin)

    respuesta = client.get(f"/vista-publica/publica/{codigo}/indicadores")
    assert respuesta.status_code == 200
    por_clave = {item["clave"]: item["valor"] for item in respuesta.json()["indicadores"]}

    assert por_clave == {
        "cumplimiento_poes": 50.0,
        "equipos_al_dia": 50.0,
        "personal_apto": 50.0,
        "documentos_vigentes": 50.0,
        "elementos_al_dia": 50.0,
    }


def test_equipos_al_dia_exige_calibracion_y_mantenimiento_vigentes(
    cliente_indicadores,
):
    client, db, admin, _ = cliente_indicadores

    db.info["sin_auditoria"] = True
    try:
        # A: calibración y mantenimiento vigentes -> al día.
        a = _crear_equipo(db, "Equipo A")
        _plan_equipo(db, a, "calibracion", dias_desde_intervencion=5)
        _plan_equipo(db, a, "mantenimiento", dias_desde_intervencion=5)
        # B: calibración vigente pero mantenimiento vencido -> no está al día.
        b = _crear_equipo(db, "Equipo B")
        _plan_equipo(db, b, "calibracion", dias_desde_intervencion=5)
        _plan_equipo(db, b, "mantenimiento", dias_desde_intervencion=60)
        # C: solo tiene mantenimiento y está vigente -> al día.
        c = _crear_equipo(db, "Equipo C")
        _plan_equipo(db, c, "mantenimiento", dias_desde_intervencion=5)
        # D: sin ningún plan -> no entra en el universo.
        _crear_equipo(db, "Equipo D")
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    codigo = _activar(client, admin)

    assert _valores_publicos(client, codigo)["equipos_al_dia"]["valor"] == 66.7


def test_personal_apto_no_se_publica_con_menos_de_cinco_personas(
    cliente_indicadores,
):
    client, db, admin, _ = cliente_indicadores

    db.info["sin_auditoria"] = True
    try:
        aptitud = Aptitud(nombre="Carnet")
        db.add(aptitud)
        db.flush()
        _personas_con_aptitud(db, 4, aptitud)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    codigo = _activar(client, admin)

    # Con 4 personas el porcentaje permitiría deducir la situación de alguien.
    assert "personal_apto" not in _valores_publicos(client, codigo)

    db.info["sin_auditoria"] = True
    try:
        _personas_con_aptitud(db, 1, db.query(Aptitud).one())
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    assert _valores_publicos(client, codigo)["personal_apto"]["valor"] == 100.0


@pytest.mark.parametrize(
    ("actual", "anterior", "esperada"),
    [
        # (completadas, total) del período actual y del anterior.
        ((2, 2), (1, 2), 50.0),  # 100 % vs 50 %: mejoró 50 puntos.
        ((1, 2), (2, 2), None),  # empeoró: no se publica la baja.
        ((1, 2), (1, 2), None),  # sin cambios: no hay tendencia que mostrar.
        ((2, 2), None, None),  # sin período anterior: nada con qué comparar.
    ],
)
def test_tendencia_de_limpieza_solo_se_publica_si_mejora(
    cliente_indicadores, actual, anterior, esperada
):
    client, db, admin, _ = cliente_indicadores

    db.info["sin_auditoria"] = True
    try:
        equipo = _crear_equipo(db, "Heladera")
        plan = _plan_limpieza(db, equipo)
        _registrar_limpieza(db, equipo, plan, 0, completadas=actual[0], total=actual[1])
        if anterior is not None:
            # Día 45 hacia atrás: cae dentro de la ventana de 30 días previa.
            _registrar_limpieza(
                db, equipo, plan, 45, completadas=anterior[0], total=anterior[1]
            )
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    _habilitar_todos(client, admin)
    codigo = _activar(client, admin)

    indicador = _valores_publicos(client, codigo)["cumplimiento_poes"]
    assert indicador["tendencia"] == esperada
    # Solo la limpieza informa tendencia.
    otros = _valores_publicos(client, codigo)
    assert all(
        item["tendencia"] is None
        for clave, item in otros.items()
        if clave != "cumplimiento_poes"
    )


def test_indicadores_sin_datos_no_se_publican(cliente_indicadores):
    client, _, admin, _ = cliente_indicadores
    _habilitar_todos(client, admin)
    codigo = _activar(client, admin)

    # Base vacía: ningún indicador tiene universo que medir, así que la vista
    # pública no muestra tarjetas vacías ni un 0 % falso.
    respuesta = client.get(f"/vista-publica/publica/{codigo}/indicadores")
    assert respuesta.status_code == 200
    assert respuesta.json()["indicadores"] == []


def test_admin_ve_si_un_indicador_visible_tiene_datos(cliente_indicadores):
    client, db, admin, _ = cliente_indicadores

    db.info["sin_auditoria"] = True
    try:
        equipo = _crear_equipo(db, "Heladera")
        _plan_equipo(db, equipo, "calibracion", dias_desde_intervencion=5)
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    catalogo = client.get("/vista-publica/indicadores", headers=admin).json()
    por_clave = {item["clave"]: item for item in catalogo["indicadores"]}

    # Equipos ya tiene universo; documentación todavía no.
    assert por_clave["equipos_al_dia"]["habilitado"] is True
    assert por_clave["equipos_al_dia"]["con_datos"] is True
    assert por_clave["documentos_vigentes"]["habilitado"] is True
    assert por_clave["documentos_vigentes"]["con_datos"] is False

    # El PUT también devuelve el flag, para que el panel se actualice sin
    # volver a consultar el catálogo.
    respuesta = client.put(
        "/vista-publica/indicadores",
        json={"indicadores": [{"clave": "cumplimiento_poes", "habilitado": True}]},
        headers=admin,
    )
    assert respuesta.status_code == 200
    actualizados = {item["clave"]: item for item in respuesta.json()["indicadores"]}
    assert actualizados["equipos_al_dia"]["con_datos"] is True
    assert actualizados["cumplimiento_poes"]["con_datos"] is False
