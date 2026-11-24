"""E9 – Receta de producto: criterios de aceptación de las tres historias."""

from decimal import Decimal

import pytest

from src.lotes import schemas as lotes_schemas
from src.lotes import services as lotes_services
from src.recetas import exceptions, schemas, services
from src.recetas.models import VersionReceta

from .conftest import receta_datos


# --------------------------------------------------------------------------
# H1 – Definir receta versionada
# --------------------------------------------------------------------------

def test_si_es_aditivo_sale_del_maestro_de_ingredientes(escenario):
    es_aditivo = {i.ingrediente_id: i.es_aditivo for i in escenario.version1.ingredientes}

    assert es_aditivo == {escenario.harina.id: False, escenario.sal.id: True}


def test_el_detalle_muestra_clase_funcional_nombre_completo_e_ins(client, escenario):
    respuesta = client.get(
        f"/recetas/versiones/{escenario.version1.id}", headers=escenario.h_operador
    )

    renglones = {r["ingrediente"]["nombre"]: r for r in respuesta.json()["ingredientes"]}
    assert renglones["Harina 000"]["aditivo"] is None
    assert renglones["Sal fina"]["aditivo"] == {
        "id": escenario.sal.id,
        "nombre": "Sal fina",
        "numero_ins": "331",
        "clase_funcional": "Regulador de acidez",
        "ins_opcional": False,
    }


def test_reclasificar_el_ingrediente_no_altera_versiones_guardadas(escenario):
    escenario.sal.es_aditivo = False
    escenario.sal.clase_funcional_id = None
    escenario.sal.numero_ins = None
    escenario.db.commit()

    version = services.obtener_version(escenario.db, escenario.version1.id)
    assert {i.es_aditivo for i in version.ingredientes} == {False, True}


def test_no_se_guarda_una_receta_solo_con_aditivos(escenario):
    datos = schemas.VersionRecetaIn(
        rendimiento=Decimal("5"),
        unidad_medida_id=escenario.kg.id,
        ingredientes=[{"ingrediente_id": escenario.sal.id, "cantidad": "1", "unidad_medida_id": escenario.kg.id}],
        tareas=[{"descripcion": "Mezclar", "ingredientes": [{"ingrediente_id": escenario.sal.id, "cantidad": "1"}]}],
    )

    with pytest.raises(exceptions.SinIngredientes):
        services.crear_version(escenario.db, escenario.receta.id, datos, escenario.admin)


def test_no_se_guarda_sin_ingredientes_ni_sin_rendimiento(client, escenario):
    cuerpo = receta_datos(escenario).model_dump(mode="json")
    url = f"/recetas/{escenario.receta.id}/versiones"

    assert client.post(url, json={**cuerpo, "ingredientes": []}, headers=escenario.h_admin).status_code == 422
    assert client.post(url, json={**cuerpo, "rendimiento": "0"}, headers=escenario.h_admin).status_code == 422
    sin_rendimiento = {k: v for k, v in cuerpo.items() if k != "rendimiento"}
    assert client.post(url, json=sin_rendimiento, headers=escenario.h_admin).status_code == 422


def test_un_aditivo_sin_cantidad_se_rechaza(client, escenario):
    cuerpo = receta_datos(escenario).model_dump(mode="json")
    cuerpo["ingredientes"][1]["cantidad"] = "0"

    respuesta = client.post(
        f"/recetas/{escenario.receta.id}/versiones", json=cuerpo, headers=escenario.h_admin
    )
    assert respuesta.status_code == 422


def test_un_aditivo_sin_clase_funcional_se_rechaza(escenario):
    """El CHECK de la base lo impide; el service también lo valida por si hay
    datos viejos. Se simula en memoria (sin flush) un aditivo sin clase."""
    escenario.sal.clase_funcional = None

    with pytest.raises(exceptions.AditivoSinClase):
        services._validar_ingredientes(escenario.db, receta_datos(escenario))
    escenario.db.rollback()


def test_la_porcion_o_unidad_de_venta_se_guarda_en_la_version(client, escenario):
    cuerpo = receta_datos(escenario).model_dump(mode="json")
    cuerpo.update(porcion_descripcion="Pan", porcion_cantidad="0.5", porcion_unidad_medida_id=escenario.kg.id)

    respuesta = client.post(
        f"/recetas/{escenario.receta.id}/versiones", json=cuerpo, headers=escenario.h_admin
    )

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["porcion_descripcion"] == "Pan"
    assert datos["porcion_cantidad"] == "0.500"
    assert datos["porcion_unidad_medida"]["simbolo"] == "kg"


def test_la_porcion_con_cantidad_exige_unidad(escenario):
    datos = receta_datos(escenario).model_copy(update={"porcion_cantidad": Decimal("0.5")})

    with pytest.raises(exceptions.PorcionSinUnidad):
        services.crear_version(escenario.db, escenario.receta.id, datos, escenario.admin)


# --------------------------------------------------------------------------
# H2 – Escalar receta a mi lote
# --------------------------------------------------------------------------

def test_escalar_por_cantidad_objetivo(client, escenario):
    respuesta = client.get(
        f"/recetas/{escenario.receta.id}/escalado?cantidad_objetivo=50",
        headers=escenario.h_operador,
    )

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["factor"] == "2.500000"
    assert datos["cantidad_objetivo"] == "50.000"
    cantidades = {i["ingrediente"]["nombre"]: i["cantidad_escalada"] for i in datos["ingredientes"]}
    assert cantidades == {"Harina 000": "25.000", "Sal fina": "5.000"}
    assert datos["tareas"][0]["ingredientes"][0]["cantidad_escalada"] == "25.000"
    # Respeta la unidad de cada ingrediente.
    assert {i["unidad_medida"]["simbolo"] for i in datos["ingredientes"]} == {"kg"}


def test_escalar_por_factor_multiplicador(client, escenario):
    respuesta = client.get(
        f"/recetas/{escenario.receta.id}/escalado?factor=2", headers=escenario.h_operador
    )

    datos = respuesta.json()
    assert datos["cantidad_objetivo"] == "40.000"
    assert {i["ingrediente"]["nombre"]: i["cantidad_escalada"] for i in datos["ingredientes"]} == {
        "Harina 000": "20.000",
        "Sal fina": "4.000",
    }


def test_escalar_pide_uno_solo_de_los_dos_parametros(client, escenario):
    url = f"/recetas/{escenario.receta.id}/escalado"

    assert client.get(url, headers=escenario.h_operador).status_code == 400
    assert client.get(f"{url}?factor=2&cantidad_objetivo=10", headers=escenario.h_operador).status_code == 400


def test_escalar_no_modifica_la_receta_guardada(client, escenario):
    antes = escenario.db.query(VersionReceta).count()

    client.get(f"/recetas/{escenario.receta.id}/escalado?factor=3", headers=escenario.h_operador)

    escenario.db.expire_all()
    version = services.obtener_version(escenario.db, escenario.version1.id)
    assert escenario.db.query(VersionReceta).count() == antes
    assert {i.cantidad for i in version.ingredientes} == {Decimal("10.000"), Decimal("2.000")}


def test_el_lote_se_puede_iniciar_con_un_factor(escenario):
    lote = lotes_services.crear_lote(
        escenario.db,
        lotes_schemas.LoteCreate(producto_id=escenario.pan.id, factor=Decimal("2")),
        escenario.operador,
    )

    assert lote.cantidad_objetivo == Decimal("40.000")
    assert lote.factor_escala == Decimal("2.000000")


def test_api_el_operador_inicia_el_lote_con_las_cantidades_escaladas(client, escenario):
    escalado = client.get(
        f"/recetas/{escenario.receta.id}/escalado?cantidad_objetivo=50",
        headers=escenario.h_operador,
    ).json()

    lote = client.post(
        "/lotes",
        json={"producto_id": escenario.pan.id, "cantidad_objetivo": escalado["cantidad_objetivo"]},
        headers=escenario.h_operador,
    )

    assert lote.status_code == 201
    planificado = {
        i["ingrediente_nombre"]: i["cantidad_planificada"]
        for item in lote.json()["checklist"]
        for i in item["ingredientes"]
    }
    assert planificado == {"Harina 000": "25.000", "Sal fina": "5.000"}


def test_crear_lote_pide_cantidad_o_factor(client, escenario):
    respuesta = client.post(
        "/lotes", json={"producto_id": escenario.pan.id}, headers=escenario.h_operador
    )
    assert respuesta.status_code == 400


# --------------------------------------------------------------------------
# H3 – Consultar receta vigente
# --------------------------------------------------------------------------

def test_la_receta_muestra_por_defecto_la_version_vigente(client, escenario):
    services.crear_version(
        escenario.db, escenario.receta.id, receta_datos(escenario, harina_total="12"), escenario.admin
    )

    receta = client.get(f"/recetas/{escenario.receta.id}", headers=escenario.h_operador).json()
    versiones = client.get(
        f"/recetas/{escenario.receta.id}/versiones", headers=escenario.h_operador
    ).json()

    assert receta["version_vigente"]["numero"] == 2
    assert [v["numero"] for v in versiones] == [1, 2]
