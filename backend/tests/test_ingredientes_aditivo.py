"""E9: el maestro de ingredientes marca cuáles son aditivos (`es_aditivo`).

Un aditivo apunta a la lista de referencia (clase funcional, nombre completo
e INS); un ingrediente que no es aditivo no lleva esos datos.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from src.aditivos.models import ClaseFuncional
from src.auth.services import crear_access_token
from src.database import get_db
from src.ingredientes.models import Ingrediente
from src.ingredientes.router import router as ingredientes_router
from src.personal.models import Personal
from src.unidadMedida.constants import TIPO_MASA
from src.unidadMedida.models import UnidadMedida


@pytest.fixture
def client_ingredientes(db_session):
    app = FastAPI()
    app.include_router(ingredientes_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def headers_admin(db_session):
    usuario = Personal(
        nombre="Admin", apellido="Ingredientes", dni="87654321",
        email="admin.ingredientes@test.local", password="x",
        puede_operar=True, puede_administrar=True,
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(usuario)
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    token, _, _ = crear_access_token(str(usuario.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def maestro(db_session):
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg", tipo=TIPO_MASA, factor_a_base=1000)
    conservante = ClaseFuncional(nombre="Conservante")
    harina = Ingrediente(nombre="Harina", unidad_medida=unidad)
    aditivo = Ingrediente(
        nombre="Sorbato", es_aditivo=True, clase_funcional=conservante, numero_ins="202", unidad_medida=unidad
    )
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([unidad, conservante, harina, aditivo])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    return {"unidad": unidad, "conservante": conservante, "harina": harina, "aditivo": aditivo}


def test_por_defecto_no_es_aditivo(db_session, maestro):
    assert maestro["harina"].es_aditivo is False
    assert maestro["harina"].clase_funcional_id is None
    assert maestro["harina"].numero_ins is None


def test_listado_filtra_por_aditivo(db_session, maestro):
    from src.ingredientes import services

    assert services.listar_ingredientes(db_session) == [maestro["harina"], maestro["aditivo"]]
    assert services.listar_ingredientes(db_session, es_aditivo=True) == [maestro["aditivo"]]
    assert services.listar_ingredientes(db_session, es_aditivo=False) == [maestro["harina"]]


def test_api_muestra_el_aditivo_con_clase_nombre_e_ins(client_ingredientes, headers_admin, maestro):
    respuesta = client_ingredientes.get("/ingredientes?es_aditivo=true", headers=headers_admin)

    assert respuesta.status_code == 200
    (ingrediente,) = respuesta.json()
    assert ingrediente["es_aditivo"] is True
    assert ingrediente["aditivo"] == {
        "id": maestro["aditivo"].id,
        "nombre": "Sorbato",
        "numero_ins": "202",
        "clase_funcional": "Conservante",
        "ins_opcional": False,
    }


def test_api_un_aditivo_exige_clase_funcional(client_ingredientes, headers_admin, maestro):
    base = {"nombre": "Benzoato", "unidad_medida_id": maestro["unidad"].id, "es_aditivo": True, "numero_ins": "211"}

    sin_clase = client_ingredientes.post("/ingredientes", json=base, headers=headers_admin)
    assert sin_clase.status_code == 400

    con_clase = client_ingredientes.post(
        "/ingredientes", json={**base, "clase_funcional_id": maestro["conservante"].id}, headers=headers_admin
    )
    assert con_clase.status_code == 200
    assert con_clase.json()["aditivo"]["numero_ins"] == "211"


def test_api_un_ingrediente_que_no_es_aditivo_no_guarda_clase_ni_ins(client_ingredientes, headers_admin, maestro):
    respuesta = client_ingredientes.post(
        "/ingredientes",
        json={
            "nombre": "Azúcar",
            "unidad_medida_id": maestro["unidad"].id,
            "es_aditivo": False,
            "clase_funcional_id": maestro["conservante"].id,
            "numero_ins": "202",
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 200
    assert (respuesta.json()["clase_funcional_id"], respuesta.json()["numero_ins"]) == (None, None)


def test_api_desmarcar_aditivo_limpia_la_referencia(
    client_ingredientes, headers_admin, maestro
):
    respuesta = client_ingredientes.put(
        f"/ingredientes/{maestro['aditivo'].id}", json={"es_aditivo": False}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["es_aditivo"] is False
    assert respuesta.json()["aditivo"] is None


def test_api_clase_dada_de_baja_no_se_puede_elegir(client_ingredientes, headers_admin, maestro, db_session):
    maestro["conservante"].activo = False
    db_session.commit()
    respuesta = client_ingredientes.put(
        f"/ingredientes/{maestro['harina'].id}",
        json={"es_aditivo": True, "clase_funcional_id": maestro["conservante"].id, "numero_ins": "202"},
        headers=headers_admin,
    )
    assert respuesta.status_code == 400


def test_api_no_se_repite_el_ins_entre_ingredientes(client_ingredientes, headers_admin, maestro, db_session):
    # Otro "Sorbato" con el mismo INS sería la misma especificación: su marca
    # se carga como insumo del ingrediente que ya existe.
    datos = {
        "nombre": "Sorbato de potasio granulado",
        "unidad_medida_id": maestro["unidad"].id,
        "es_aditivo": True,
        "clase_funcional_id": maestro["conservante"].id,
        "numero_ins": "INS 202",
    }
    repetido = client_ingredientes.post("/ingredientes", json=datos, headers=headers_admin)
    assert repetido.status_code == 400
    assert "Sorbato" in repetido.json()["detail"]

    # Tampoco al modificar otro ingrediente, ni con el original dado de baja.
    maestro["aditivo"].activo = False
    db_session.commit()
    modificado = client_ingredientes.put(
        f"/ingredientes/{maestro['harina'].id}",
        json={"es_aditivo": True, "clase_funcional_id": maestro["conservante"].id, "numero_ins": "202"},
        headers=headers_admin,
    )
    assert modificado.status_code == 400
    assert "dado de baja" in modificado.json()["detail"]

    # El propio ingrediente puede volver a guardar su INS.
    mismo = client_ingredientes.put(
        f"/ingredientes/{maestro['aditivo'].id}", json={"numero_ins": "202"}, headers=headers_admin
    )
    assert mismo.status_code == 200


def test_la_base_impide_dos_ingredientes_con_el_mismo_ins(db_session, maestro):
    db_session.add(
        Ingrediente(
            nombre="Otro sorbato", es_aditivo=True, clase_funcional=maestro["conservante"],
            numero_ins="202", unidad_medida=maestro["unidad"],
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_la_base_impide_un_aditivo_sin_clase(db_session, maestro):
    db_session.add(Ingrediente(nombre="Colorante suelto", es_aditivo=True, unidad_medida=maestro["unidad"]))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
