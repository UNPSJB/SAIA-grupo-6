"""E9: el maestro de insumos distingue ingredientes de aditivos.

Un aditivo apunta a la lista de referencia (clase funcional, nombre completo
e INS); un ingrediente no lleva esos datos.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from src.aditivos.models import Aditivo, ClaseFuncional
from src.auth.services import crear_access_token
from src.database import get_db
from src.insumos.models import TIPO_ADITIVO, TIPO_INGREDIENTE, Insumo
from src.insumos.router import router as insumos_router
from src.personal.models import Personal
from src.unidadMedida.models import UnidadMedida


@pytest.fixture
def client_insumos(db_session):
    app = FastAPI()
    app.include_router(insumos_router)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def headers_admin(db_session):
    usuario = Personal(
        nombre="Admin", apellido="Insumos", dni="87654321",
        email="admin.insumos@test.local", password="x",
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
    unidad = UnidadMedida(nombre="Kilogramo", simbolo="kg")
    conservante = ClaseFuncional(nombre="Conservante")
    sorbato = Aditivo(clase_funcional=conservante, nombre="Sorbato de potasio", numero_ins="202")
    harina = Insumo(nombre="Harina", unidad_medida=unidad)
    aditivo = Insumo(nombre="Sorbato", tipo=TIPO_ADITIVO, aditivo=sorbato, unidad_medida=unidad)
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add_all([unidad, conservante, sorbato, harina, aditivo])
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)
    return {"unidad": unidad, "sorbato": sorbato, "harina": harina, "aditivo": aditivo}


def test_el_tipo_por_defecto_es_ingrediente(db_session, maestro):
    assert maestro["harina"].tipo == TIPO_INGREDIENTE
    assert maestro["harina"].aditivo_id is None


def test_listado_filtra_por_tipo(db_session, maestro):
    from src.insumos import services

    assert services.listar_insumos(db_session) == [maestro["harina"], maestro["aditivo"]]
    assert services.listar_insumos(db_session, tipo=TIPO_ADITIVO) == [maestro["aditivo"]]
    assert services.listar_insumos(db_session, tipo=TIPO_INGREDIENTE) == [maestro["harina"]]


def test_api_muestra_el_aditivo_con_clase_nombre_e_ins(client_insumos, headers_admin, maestro):
    respuesta = client_insumos.get("/insumos?tipo=aditivo", headers=headers_admin)

    assert respuesta.status_code == 200
    (insumo,) = respuesta.json()
    assert insumo["tipo"] == "aditivo"
    assert insumo["aditivo"] == {
        "id": maestro["sorbato"].id,
        "nombre": "Sorbato de potasio",
        "numero_ins": "202",
        "clase_funcional": "Conservante",
    }


def test_api_un_aditivo_exige_referencia(client_insumos, headers_admin, maestro):
    base = {"nombre": "Benzoato", "unidad_medida_id": maestro["unidad"].id, "tipo": "aditivo"}

    sin_referencia = client_insumos.post("/insumos", json=base, headers=headers_admin)
    assert sin_referencia.status_code == 400

    con_referencia = client_insumos.post(
        "/insumos", json={**base, "aditivo_id": maestro["sorbato"].id}, headers=headers_admin
    )
    assert con_referencia.status_code == 200
    assert con_referencia.json()["aditivo"]["numero_ins"] == "202"


def test_api_un_ingrediente_no_guarda_datos_de_aditivo(client_insumos, headers_admin, maestro):
    respuesta = client_insumos.post(
        "/insumos",
        json={
            "nombre": "Azúcar",
            "unidad_medida_id": maestro["unidad"].id,
            "tipo": "ingrediente",
            "aditivo_id": maestro["sorbato"].id,
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["aditivo_id"] is None


def test_api_pasar_de_aditivo_a_ingrediente_limpia_la_referencia(
    client_insumos, headers_admin, maestro
):
    respuesta = client_insumos.put(
        f"/insumos/{maestro['aditivo'].id}", json={"tipo": "ingrediente"}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["tipo"] == "ingrediente"
    assert respuesta.json()["aditivo"] is None


def test_api_aditivo_dado_de_baja_no_se_puede_elegir(client_insumos, headers_admin, maestro, db_session):
    maestro["sorbato"].activo = False
    db_session.commit()
    respuesta = client_insumos.put(
        f"/insumos/{maestro['harina'].id}",
        json={"tipo": "aditivo", "aditivo_id": maestro["sorbato"].id},
        headers=headers_admin,
    )
    assert respuesta.status_code == 400


def test_la_base_impide_un_aditivo_sin_referencia(db_session, maestro):
    db_session.add(Insumo(nombre="Colorante suelto", tipo=TIPO_ADITIVO, unidad_medida=maestro["unidad"]))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
