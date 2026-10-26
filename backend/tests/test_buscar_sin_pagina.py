"""Regresión: `buscar` ya no se ignora cuando no viene `page`.

Antes, los routers de incidentes y notificaciones descartaban el término de
búsqueda en silencio en el camino sin paginación: un cliente que pedía
`GET /x?buscar=algo` recibía la lista completa sin filtrar. Ahora el filtro
se aplica en ambos caminos con la misma lógica (helper compartido en cada
service), insensible a mayúsculas y tildes.

Cómo correrlo (desde `backend/`):

    python -m pytest tests/test_buscar_sin_pagina.py -v
"""

from datetime import date, timedelta

import pytest

from src.elementoLimpieza.models import ElementoLimpieza
from src.incidente.models import Incidente


@pytest.fixture()
def incidentes(session_factory, usuarios):
    """Dos incidentes distinguibles por título y descripción; se borran al final."""
    with session_factory() as db:
        creados = [
            Incidente(
                titulo="Falla de la bomba de agua",
                descripcion="El equipo dejó de funcionar",
                tipo="falla_equipo",
                usuario_id=usuarios["admin_id"],
            ),
            Incidente(
                titulo="Derrame de químico",
                descripcion="Se derramó reactivo en la mesada",
                tipo="higiene_contaminacion",
                usuario_id=usuarios["admin_id"],
            ),
        ]
        db.add_all(creados)
        db.commit()
        yield
        for incidente in creados:
            db.delete(incidente)
        db.commit()


@pytest.fixture()
def elementos_vencidos(session_factory):
    """Dos elementos de limpieza vencidos: cada uno genera una notificación
    cuyo MENSAJE lo nombra (los títulos de ambas son iguales, así el filtro
    demuestra que también mira el mensaje)."""
    with session_factory() as db:
        recambio_viejo = date.today() - timedelta(days=90)
        creados = [
            ElementoLimpieza(
                nombre="Trapito de test",
                frecuencia_recambio_dias=30,
                fecha_ultimo_recambio=recambio_viejo,
            ),
            ElementoLimpieza(
                nombre="Guante de test",
                frecuencia_recambio_dias=30,
                fecha_ultimo_recambio=recambio_viejo,
            ),
        ]
        db.add_all(creados)
        db.commit()
        yield
        for elemento in creados:
            db.delete(elemento)
        db.commit()


def test_el_listado_completo_de_incidentes_trae_ambos(client, H_ADMIN, incidentes):
    respuesta = client.get("/incidentes?orden=antiguos", headers=H_ADMIN)
    assert respuesta.status_code == 200, respuesta.text
    titulos = {i["titulo"] for i in respuesta.json()}
    assert {"Falla de la bomba de agua", "Derrame de químico"} <= titulos


def test_buscar_sin_page_filtra_incidentes(client, H_ADMIN, incidentes):
    """LA regresión: el término ya no se descarta cuando falta `page`."""
    respuesta = client.get(
        "/incidentes?buscar=BOMBA&orden=antiguos", headers=H_ADMIN
    )
    assert respuesta.status_code == 200, respuesta.text
    assert {i["titulo"] for i in respuesta.json()} == {"Falla de la bomba de agua"}


def test_buscar_sin_page_ignora_mayusculas_y_tildes(client, H_ADMIN, incidentes):
    respuesta = client.get(
        "/incidentes?buscar=quimico&orden=antiguos", headers=H_ADMIN
    )
    assert respuesta.status_code == 200, respuesta.text
    assert {i["titulo"] for i in respuesta.json()} == {"Derrame de químico"}


def test_el_listado_completo_de_notificaciones_trae_ambas(
    client, H_ADMIN, elementos_vencidos
):
    respuesta = client.get("/notificaciones", headers=H_ADMIN)
    assert respuesta.status_code == 200, respuesta.text
    mensajes = " | ".join(n["mensaje"] for n in respuesta.json())
    assert "Trapito de test" in mensajes
    assert "Guante de test" in mensajes


def test_buscar_sin_page_filtra_notificaciones_por_mensaje(
    client, H_ADMIN, elementos_vencidos
):
    """LA regresón: el término ya no se descarta cuando falta `page`."""
    respuesta = client.get("/notificaciones?buscar=trapito", headers=H_ADMIN)
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert "Trapito de test" in cuerpo[0]["mensaje"]


def test_buscar_sin_page_sin_coincidencias_devuelve_lista_vacia(
    client, H_ADMIN, elementos_vencidos
):
    respuesta = client.get(
        "/notificaciones?buscar=termino-que-no-existe", headers=H_ADMIN
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == []
