"""Tests de permisos y validación de los endpoints de paneles."""

from datetime import timedelta

import pytest

from src.common.fechas import hoy

PANELES_DE_ADMINISTRACION = ("produccion", "inventario", "equipos", "calidad", "personas")
# El operario solo ve el de limpieza, recortado a sus tareas (su cumplimiento).
PANELES_DE_OPERACION = ("limpieza",)


def _rango(dias: int = 30) -> dict:
    return {"desde": str(hoy() - timedelta(days=dias - 1)), "hasta": str(hoy())}


@pytest.mark.parametrize("categoria", PANELES_DE_ADMINISTRACION + PANELES_DE_OPERACION)
def test_panel_responde_al_administrador(client, usuarios, categoria):
    respuesta = client.get(f"/paneles/{categoria}", params=_rango(), headers=usuarios["admin"])

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["periodo"] == _rango()


@pytest.mark.parametrize("categoria", PANELES_DE_ADMINISTRACION)
def test_panel_de_administracion_rechaza_al_operador(client, usuarios, categoria):
    respuesta = client.get(f"/paneles/{categoria}", params=_rango(), headers=usuarios["operador"])

    assert respuesta.status_code == 403


def test_operador_recibe_solo_lo_propio(client, usuarios):
    limpieza = client.get("/paneles/limpieza", params=_rango(), headers=usuarios["operador"]).json()

    assert limpieza["solo_propias"] is True and limpieza["atencion"] is None


def test_panel_sin_sesion(client):
    assert client.get("/paneles/produccion", params=_rango()).status_code == 401


def test_panel_valida_el_periodo(client, usuarios):
    al_reves = {"desde": str(hoy()), "hasta": str(hoy() - timedelta(days=1))}
    assert client.get("/paneles/equipos", params=al_reves, headers=usuarios["admin"]).status_code == 400
    assert client.get("/paneles/equipos", headers=usuarios["admin"]).status_code == 422
    con_tipo_invalido = {**_rango(), "tipo": "inexistente"}
    assert client.get("/paneles/calidad", params=con_tipo_invalido, headers=usuarios["admin"]).status_code == 422


def test_inicio_segun_permisos(client, usuarios):
    admin = client.get("/paneles/inicio", headers=usuarios["admin"])
    operador = client.get("/paneles/inicio", headers=usuarios["operador"])

    assert admin.status_code == 200
    assert [g["clave"] for g in admin.json()["grupos"]] == ["produccion", "inventario", "calidad"]
    assert operador.status_code == 200
    assert operador.json()["grupos"] == []
    assert operador.json()["vencen_hoy"] is None
    assert client.get("/paneles/inicio").status_code == 401
