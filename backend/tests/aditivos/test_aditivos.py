"""E9: lista de referencia de aditivos (clase funcional, nombre completo, INS).

La lista se actualiza desde la app; el INS es obligatorio salvo en las
clases que se declaran solo por su función (aromatizantes).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.aditivos.models import Aditivo, ClaseFuncional
from src.aditivos.router import router as aditivos_router
from src.auth.services import crear_access_token
from src.database import get_db
from src.personal.models import Personal


def _headers(db, dni, admin):
    persona = Personal(
        nombre="Ana", apellido="Prueba", dni=dni, email=f"{dni}@test.local", password="x",
        puede_operar=True, puede_administrar=admin,
    )
    db.add(persona)
    db.commit()
    token, _, _ = crear_access_token(str(persona.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def ctx(db_session):
    app = FastAPI()
    app.include_router(aditivos_router)
    app.dependency_overrides[get_db] = lambda: db_session
    conservante = ClaseFuncional(nombre="Conservante")
    aromatizante = ClaseFuncional(nombre="Aromatizante", ins_opcional=True)
    db_session.add_all([conservante, aromatizante])
    db_session.commit()
    try:
        yield {
            "client": TestClient(app),
            "db": db_session,
            "admin": _headers(db_session, "20000001", True),
            "operador": _headers(db_session, "20000002", False),
            "conservante": conservante,
            "aromatizante": aromatizante,
        }
    finally:
        app.dependency_overrides.clear()


def test_alta_de_aditivo_con_clase_nombre_e_ins(ctx):
    respuesta = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": "Sorbato de potasio", "numero_ins": "INS 202"},
        headers=ctx["admin"],
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["numero_ins"] == "202"
    assert datos["clase_funcional"]["nombre"] == "Conservante"


@pytest.mark.parametrize("ins", ["160a", "150d", "500(ii)", "1422"])
def test_acepta_formatos_ins_del_codex(ctx, ins):
    respuesta = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": f"Aditivo {ins}", "numero_ins": ins},
        headers=ctx["admin"],
    )
    assert respuesta.status_code == 201


def test_ins_invalido_se_rechaza(ctx):
    respuesta = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": "Raro", "numero_ins": "abc"},
        headers=ctx["admin"],
    )
    assert respuesta.status_code == 400


def test_ins_obligatorio_salvo_aromatizantes(ctx):
    sin_ins = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": "Benzoato de sodio"},
        headers=ctx["admin"],
    )
    aroma = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["aromatizante"].id, "nombre": "Aroma de vainilla"},
        headers=ctx["admin"],
    )

    assert sin_ins.status_code == 400
    assert aroma.status_code == 201
    assert aroma.json()["numero_ins"] is None


def test_no_se_repite_el_nombre_dentro_de_la_clase(ctx):
    cuerpo = {"clase_funcional_id": ctx["conservante"].id, "nombre": "Nitrito de sodio", "numero_ins": "250"}
    assert ctx["client"].post("/aditivos", json=cuerpo, headers=ctx["admin"]).status_code == 201
    assert ctx["client"].post("/aditivos", json=cuerpo, headers=ctx["admin"]).status_code == 400


def test_la_lista_se_actualiza_y_se_da_de_baja(ctx):
    creado = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": "Propionato", "numero_ins": "282"},
        headers=ctx["admin"],
    ).json()

    editado = ctx["client"].put(
        f"/aditivos/{creado['id']}", json={"nombre": "Propionato de calcio"}, headers=ctx["admin"]
    )
    assert editado.json()["nombre"] == "Propionato de calcio"

    ctx["client"].delete(f"/aditivos/{creado['id']}", headers=ctx["admin"])
    activos = ctx["client"].get("/aditivos", headers=ctx["admin"]).json()
    todos = ctx["client"].get("/aditivos?incluir_inactivos=true", headers=ctx["admin"]).json()
    assert creado["id"] not in [a["id"] for a in activos]
    assert creado["id"] in [a["id"] for a in todos]


def test_clases_funcionales_se_administran_desde_la_app(ctx):
    nueva = ctx["client"].post(
        "/aditivos/clases", json={"nombre": "Edulcorante"}, headers=ctx["admin"]
    )
    assert nueva.status_code == 201
    repetida = ctx["client"].post(
        "/aditivos/clases", json={"nombre": "edulcorante"}, headers=ctx["admin"]
    )
    assert repetida.status_code == 400

    nombres = [c["nombre"] for c in ctx["client"].get("/aditivos/clases", headers=ctx["admin"]).json()]
    assert nombres == ["Aromatizante", "Conservante", "Edulcorante"]


def test_clase_dada_de_baja_no_admite_aditivos_nuevos(ctx):
    ctx["client"].delete(f"/aditivos/clases/{ctx['conservante'].id}", headers=ctx["admin"])
    respuesta = ctx["client"].post(
        "/aditivos",
        json={"clase_funcional_id": ctx["conservante"].id, "nombre": "Sorbato", "numero_ins": "202"},
        headers=ctx["admin"],
    )
    assert respuesta.status_code == 400


def test_solo_administradores(ctx):
    assert ctx["client"].get("/aditivos", headers=ctx["operador"]).status_code == 403
    assert ctx["client"].get("/aditivos").status_code == 401


def test_quitar_el_ins_de_un_aditivo_que_lo_exige_se_rechaza(ctx):
    aditivo = Aditivo(clase_funcional=ctx["conservante"], nombre="Benzoato", numero_ins="211")
    ctx["db"].add(aditivo)
    ctx["db"].commit()

    respuesta = ctx["client"].put(
        f"/aditivos/{aditivo.id}", json={"numero_ins": None}, headers=ctx["admin"]
    )
    assert respuesta.status_code == 400
