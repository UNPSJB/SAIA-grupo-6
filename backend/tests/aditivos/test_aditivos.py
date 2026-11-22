"""Aditivos: un ingrediente con `es_aditivo`, su clase funcional e INS.

Las clases funcionales se administran desde la app. El INS es obligatorio
salvo en las clases que se declaran solo por su función (aromatizantes). La
lista de referencia del Codex / CAA solo sirve para sugerir clase e INS.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.aditivos.models import ClaseFuncional
from src.aditivos.router import router as aditivos_router
from src.auth.services import crear_access_token
from src.database import get_db
from src.ingredientes.router import router as ingredientes_router
from src.personal.models import Personal
from src.unidadMedida.models import UnidadMedida


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
    app.include_router(ingredientes_router)
    app.dependency_overrides[get_db] = lambda: db_session
    conservante = ClaseFuncional(nombre="Conservante")
    aromatizante = ClaseFuncional(nombre="Aromatizante", ins_opcional=True)
    gramo = UnidadMedida(nombre="Gramo", simbolo="g", tipo="masa", factor_a_base=1)
    db_session.add_all([conservante, aromatizante, gramo])
    db_session.commit()
    try:
        yield {
            "client": TestClient(app),
            "db": db_session,
            "admin": _headers(db_session, "20000001", True),
            "operador": _headers(db_session, "20000002", False),
            "conservante": conservante,
            "aromatizante": aromatizante,
            "gramo": gramo,
        }
    finally:
        app.dependency_overrides.clear()


def _alta(ctx, nombre, clase, ins=None):
    cuerpo = {
        "nombre": nombre,
        "unidad_medida_id": ctx["gramo"].id,
        "es_aditivo": True,
        "clase_funcional_id": clase.id,
    }
    if ins is not None:
        cuerpo["numero_ins"] = ins
    return ctx["client"].post("/ingredientes", json=cuerpo, headers=ctx["admin"])


def test_alta_de_aditivo_con_clase_e_ins(ctx):
    respuesta = _alta(ctx, "Sorbato de potasio", ctx["conservante"], "INS 202")

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["numero_ins"] == "202"
    assert datos["clase_funcional_id"] == ctx["conservante"].id
    assert datos["aditivo"] == {
        "id": datos["id"],
        "nombre": "Sorbato de potasio",
        "numero_ins": "202",
        "clase_funcional": "Conservante",
        "ins_opcional": False,
    }


@pytest.mark.parametrize("ins", ["160a", "150d", "500(ii)", "1422"])
def test_acepta_formatos_ins_del_codex(ctx, ins):
    assert _alta(ctx, f"Aditivo {ins}", ctx["conservante"], ins).status_code == 200


def test_ins_invalido_se_rechaza(ctx):
    assert _alta(ctx, "Raro", ctx["conservante"], "abc").status_code == 400


def test_ins_obligatorio_salvo_aromatizantes(ctx):
    sin_ins = _alta(ctx, "Benzoato de sodio", ctx["conservante"])
    aroma = _alta(ctx, "Aroma de vainilla", ctx["aromatizante"])

    assert sin_ins.status_code == 400
    assert aroma.status_code == 200
    assert aroma.json()["numero_ins"] is None


def test_un_aditivo_necesita_clase(ctx):
    respuesta = ctx["client"].post(
        "/ingredientes",
        json={"nombre": "Suelto", "unidad_medida_id": ctx["gramo"].id, "es_aditivo": True, "numero_ins": "202"},
        headers=ctx["admin"],
    )
    assert respuesta.status_code == 400


def test_clase_dada_de_baja_no_admite_aditivos_nuevos(ctx):
    ctx["client"].delete(f"/aditivos/clases/{ctx['conservante'].id}", headers=ctx["admin"])
    assert _alta(ctx, "Sorbato", ctx["conservante"], "202").status_code == 400


def test_quitar_el_ins_de_un_aditivo_que_lo_exige_se_rechaza(ctx):
    creado = _alta(ctx, "Benzoato", ctx["conservante"], "211").json()

    respuesta = ctx["client"].put(
        f"/ingredientes/{creado['id']}", json={"numero_ins": None}, headers=ctx["admin"]
    )
    assert respuesta.status_code == 400


def test_desmarcar_el_aditivo_borra_clase_e_ins(ctx):
    creado = _alta(ctx, "Pectina", ctx["conservante"], "440").json()

    respuesta = ctx["client"].put(
        f"/ingredientes/{creado['id']}", json={"es_aditivo": False}, headers=ctx["admin"]
    )
    datos = respuesta.json()
    assert (datos["es_aditivo"], datos["clase_funcional_id"], datos["numero_ins"], datos["aditivo"]) == (
        False, None, None, None,
    )


def test_clases_funcionales_se_administran_desde_la_app(ctx):
    nueva = ctx["client"].post("/aditivos/clases", json={"nombre": "Edulcorante"}, headers=ctx["admin"])
    assert nueva.status_code == 201
    repetida = ctx["client"].post("/aditivos/clases", json={"nombre": "edulcorante"}, headers=ctx["admin"])
    assert repetida.status_code == 400

    nombres = [c["nombre"] for c in ctx["client"].get("/aditivos/clases", headers=ctx["admin"]).json()]
    assert nombres == ["Aromatizante", "Conservante", "Edulcorante"]


def test_sugerencias_de_la_lista_de_referencia(ctx):
    sugerencias = ctx["client"].get("/aditivos/sugerencias?buscar=sorbato", headers=ctx["admin"]).json()

    sorbato = next(s for s in sugerencias if s["nombre"] == "Sorbato de potasio")
    assert sorbato["numero_ins"] == "202"
    assert sorbato["clase_funcional"] == "Conservante"
    # Se vincula por nombre con la clase de la app.
    assert sorbato["clase_funcional_id"] == ctx["conservante"].id


def test_sugerencia_de_una_clase_que_no_esta_en_la_app(ctx):
    sugerencias = ctx["client"].get("/aditivos/sugerencias?buscar=330", headers=ctx["admin"]).json()

    citrico = next(s for s in sugerencias if s["nombre"] == "Ácido cítrico")
    assert citrico["clase_funcional_id"] is None


def test_solo_administradores(ctx):
    assert ctx["client"].get("/aditivos/clases", headers=ctx["operador"]).status_code == 403
    assert ctx["client"].get("/aditivos/sugerencias").status_code == 401
