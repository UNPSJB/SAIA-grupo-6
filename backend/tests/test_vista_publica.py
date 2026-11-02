from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

import src.migrations as migrations
from src.auditoria.models import AuditLog
from src.auth.services import crear_access_token
from src.config import settings
from src.database import get_db
from src.main import app
from src.models import ModeloBase
from src.personal.models import Personal
from src.vistaPublica.models import ConfiguracionVistaPublica


def _headers(usuario_id: int) -> dict[str, str]:
    token, _, _ = crear_access_token(str(usuario_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def cliente_vista_publica(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> Generator[tuple[TestClient, Session, dict[str, str], dict[str, str]], None, None]:
    admin = Personal(
        nombre="Ada",
        apellido="Administradora",
        dni="30999111",
        email="vista-admin@test.local",
        password="hash",
        puede_operar=True,
        puede_administrar=True,
    )
    operador = Personal(
        nombre="Omar",
        apellido="Operador",
        dni="30999222",
        email="vista-operador@test.local",
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
        # Sin context manager: no ejecutar el lifespan sobre la base local.
        client = TestClient(app)
        yield client, db_session, _headers(admin.id), _headers(operador.id)
        client.close()
    finally:
        if anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = anterior


def test_vista_publica_comienza_desactivada(cliente_vista_publica):
    client, _, admin, _ = cliente_vista_publica

    respuesta = client.get("/vista-publica/configuracion", headers=admin)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"habilitada": False, "url_publica": None}


def test_solo_admin_puede_consultar_y_modificar(cliente_vista_publica):
    client, _, _, operador = cliente_vista_publica

    assert client.get("/vista-publica/configuracion").status_code == 401
    assert client.put("/vista-publica/configuracion", json={"habilitada": True}).status_code == 401
    assert client.get("/vista-publica/configuracion", headers=operador).status_code == 403
    assert (
        client.put(
            "/vista-publica/configuracion",
            json={"habilitada": True},
            headers=operador,
        ).status_code
        == 403
    )


def test_activar_es_idempotente_y_persiste_codigo(cliente_vista_publica):
    client, db, admin, _ = cliente_vista_publica

    primera = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    segunda = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )

    assert primera.status_code == 200
    assert segunda.status_code == 200
    primera_url = primera.json()["url_publica"]
    assert primera_url == segunda.json()["url_publica"]
    assert primera_url.startswith("https://saia.test/app/publico/")
    codigo = primera_url.rsplit("/", 1)[1]
    assert len(codigo) >= 40
    assert all(caracter.isalnum() or caracter in "-_" for caracter in codigo)

    configuraciones = list(db.scalars(select(ConfiguracionVistaPublica)).all())
    assert len(configuraciones) == 1
    assert configuraciones[0].id == 1
    assert configuraciones[0].codigo_publico == codigo
    db.expire_all()
    assert db.get(ConfiguracionVistaPublica, 1).codigo_publico == codigo


def test_desactivar_invalida_y_reactivar_rota_el_codigo(cliente_vista_publica):
    client, db, admin, _ = cliente_vista_publica
    activada = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    codigo_anterior = activada.json()["url_publica"].rsplit("/", 1)[1]

    desactivada = client.put(
        "/vista-publica/configuracion", json={"habilitada": False}, headers=admin
    )
    repetida = client.put(
        "/vista-publica/configuracion", json={"habilitada": False}, headers=admin
    )
    reactivada = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )

    assert desactivada.json() == {"habilitada": False, "url_publica": None}
    assert repetida.json() == {"habilitada": False, "url_publica": None}
    codigo_nuevo = reactivada.json()["url_publica"].rsplit("/", 1)[1]
    assert codigo_nuevo != codigo_anterior
    configuracion = db.get(ConfiguracionVistaPublica, 1)
    assert configuracion is not None
    assert configuracion.habilitada is True
    assert configuracion.codigo_publico == codigo_nuevo


def test_validacion_publica_solo_acepta_el_codigo_activo(cliente_vista_publica):
    client, _, admin, _ = cliente_vista_publica
    activada = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    codigo = activada.json()["url_publica"].rsplit("/", 1)[1]

    valida = client.get(f"/vista-publica/publica/{codigo}/validar")
    invalida = client.get("/vista-publica/publica/codigo-invalido/validar")

    assert valida.status_code == 200
    assert valida.json() == {"valida": True}
    assert valida.headers["cache-control"] == "no-store, max-age=0"
    assert invalida.status_code == 404
    assert invalida.json() == {"detail": "Vista pública no disponible."}
    assert invalida.headers["cache-control"] == "no-store, max-age=0"
    assert "codigo_publico" not in invalida.text


def test_validacion_publica_invalida_codigos_antiguos(cliente_vista_publica):
    client, _, admin, _ = cliente_vista_publica
    activada = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    codigo_anterior = activada.json()["url_publica"].rsplit("/", 1)[1]

    desactivada = client.put(
        "/vista-publica/configuracion", json={"habilitada": False}, headers=admin
    )
    reactivada = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )
    codigo_nuevo = reactivada.json()["url_publica"].rsplit("/", 1)[1]

    assert desactivada.status_code == 200
    assert client.get(f"/vista-publica/publica/{codigo_anterior}/validar").status_code == 404
    assert client.get(f"/vista-publica/publica/{codigo_nuevo}/validar").status_code == 200


def test_activacion_requiere_url_publica_configurada(cliente_vista_publica, monkeypatch):
    client, db, admin, _ = cliente_vista_publica
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", None)

    respuesta = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )

    assert respuesta.status_code == 400
    assert db.get(ConfiguracionVistaPublica, 1) is None


def test_cambios_quedan_auditados_con_actor_y_codigo_redactado(cliente_vista_publica):
    client, db, admin, _ = cliente_vista_publica
    db.info["sin_auditoria"] = True
    try:
        db.add(ConfiguracionVistaPublica(id=1, habilitada=False))
        db.commit()
    finally:
        db.info.pop("sin_auditoria", None)

    respuesta = client.put(
        "/vista-publica/configuracion", json={"habilitada": True}, headers=admin
    )

    assert respuesta.status_code == 200
    auditoria = list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == "configuracion_vista_publica")
            .order_by(AuditLog.id)
        ).all()
    )
    assert len(auditoria) == 1
    assert auditoria[0].accion == "MODIFICAR"
    assert auditoria[0].usuario_id is not None
    assert auditoria[0].fecha is not None
    assert auditoria[0].cambios["habilitada"] == [False, True]
    assert auditoria[0].cambios["codigo_publico"] == ["***", "***"]


def test_migracion_inicializa_la_configuracion_sin_perder_datos(monkeypatch):
    engine = create_engine("sqlite://")
    monkeypatch.setattr(migrations, "engine", engine)
    try:
        # Base preexistente: todavía no conoce la nueva tabla de configuración.
        tablas_previas = [
            tabla
            for tabla in ModeloBase.metadata.sorted_tables
            if tabla.name != "configuracion_vista_publica"
        ]
        ModeloBase.metadata.create_all(engine, tables=tablas_previas)
        with engine.begin() as conexion:
            conexion.execute(
                text(
                    "INSERT INTO unidades_medida (nombre, simbolo, activo) "
                    "VALUES ('Litro', 'L', 1)"
                )
            )

        # El arranque agrega la tabla y la fila opt-in, sin tocar el dato previo.
        migrations.crear_tablas_y_migrar()
        # Un segundo arranque no duplica la configuración.
        migrations.crear_tablas_y_migrar()

        with engine.begin() as conexion:
            configuraciones = conexion.execute(
                text(
                    "SELECT id, habilitada, codigo_publico "
                    "FROM configuracion_vista_publica"
                )
            ).all()
            unidades = conexion.execute(
                text("SELECT nombre, simbolo FROM unidades_medida")
            ).all()

        assert configuraciones == [(1, 0, None)]
        assert unidades == [("Litro", "L")]
    finally:
        engine.dispose()
