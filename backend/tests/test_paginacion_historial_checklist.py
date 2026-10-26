"""Paginación server-side de GET /checklist/historial.

Cómo correrlo (desde `backend/`):

    python -m pytest tests/test_paginacion_historial_checklist.py -v

Todo corre contra una base SQLite EN MEMORIA con datos deterministas (ver
`tests/seed_checklists.py`); no toca `db.sqlite3` ni necesita datos cargados.

Qué se verifica, en orden:
  1. El contrato: sobre, totales, cantidad de filas por página, orden.
  2. Consistencia: recorrer todas las páginas == el listado esperado, sin
     repetir ni omitir, incluso con varios checklists por fecha.
  3. Filtros (equipo, rango de fechas) y bordes (página fuera de rango).
  4. El % general del período no depende de la página ni del tamaño.
  5. Que el recorte lo haga la BASE (LIMIT/OFFSET, COUNT, selectinload
     acotado), mirando el SQL real que ejecuta la request.
  6. Validación de parámetros y permisos.
"""

import math
import re
from contextlib import contextmanager
from datetime import timedelta

import pytest
from sqlalchemy import event

from src.checklist.constants import ErrorCode
from src.common.paginacion import PAGE_SIZE_MAXIMO

URL = "/checklist/historial"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def pedir(client, headers, seed, *, page=None, page_size=None, equipo_id=None,
          desde=None, hasta=None, esperado=200):
    params = {
        "fecha_desde": (desde or seed.desde).isoformat(),
        "fecha_hasta": (hasta or seed.hasta).isoformat(),
    }
    if page is not None:
        params["page"] = page
    if page_size is not None:
        params["page_size"] = page_size
    if equipo_id is not None:
        params["equipo_id"] = equipo_id

    respuesta = client.get(URL, params=params, headers=headers)
    assert respuesta.status_code == esperado, respuesta.text
    return respuesta.json()


def recorrer(client, headers, seed, page_size, **filtros):
    """Pide TODAS las páginas y devuelve (items concatenados, respuestas)."""
    primera = pedir(client, headers, seed, page=1, page_size=page_size, **filtros)
    respuestas = [primera]
    for pagina in range(2, primera["total_paginas"] + 1):
        respuestas.append(
            pedir(client, headers, seed, page=pagina, page_size=page_size, **filtros)
        )
    return [item for r in respuestas for item in r["items"]], respuestas


@contextmanager
def capturar_sql(engine):
    """Guarda (statement, parameters) de todo lo que ejecuta la request."""
    sentencias = []

    def _escuchar(conn, cursor, statement, parameters, context, executemany):
        sentencias.append((statement, parameters))

    event.listen(engine, "before_cursor_execute", _escuchar)
    try:
        yield sentencias
    finally:
        event.remove(engine, "before_cursor_execute", _escuchar)


def filas_que_devuelve(engine, statement, parameters):
    """Re-ejecuta una consulta capturada (de solo lectura) y cuenta sus filas."""
    with engine.connect() as conexion:
        resultado = conexion.exec_driver_sql(statement, parameters or ())
        return len(resultado.fetchall())


# ---------------------------------------------------------------------------
# 1 y 2. Contrato y consistencia entre páginas
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("page_size", [1, 2, 5, 6, 7, 12, 47, 48, 49, 100])
def test_recorrer_todas_las_paginas_da_exactamente_el_listado_esperado(
    client, H_ADMIN, seed, page_size
):
    """Sin repetidos, sin omitidos y en orden (fecha desc, id desc).

    Se compara la LISTA ORDENADA contra el oráculo, no un conjunto: así también
    falla si el desempate por `id` falta o si el orden cambia entre páginas.
    El seed tiene varios checklists por fecha y ids no monótonos con la fecha.
    """
    esperados = [c.id for c in seed.en_rango(seed.desde, seed.hasta)]

    items, respuestas = recorrer(client, H_ADMIN, seed, page_size)

    assert [i["checklist_id"] for i in items] == esperados
    # Cada pedido devolvió el mismo total (no se desplaza mientras se pagina).
    assert {r["total"] for r in respuestas} == {len(esperados)}


@pytest.mark.parametrize("page_size", [5, 6, 7, 48, 100])
def test_sobre_de_la_pagina_es_consistente(client, H_ADMIN, seed, page_size):
    total = len(seed.en_rango(seed.desde, seed.hasta))
    total_paginas = math.ceil(total / page_size)

    _, respuestas = recorrer(client, H_ADMIN, seed, page_size)

    assert len(respuestas) == total_paginas
    for numero, r in enumerate(respuestas, start=1):
        assert r["page"] == numero
        assert r["page_size"] == page_size
        assert r["total"] == total
        assert r["total_paginas"] == total_paginas
        if numero < total_paginas:
            assert len(r["items"]) == page_size  # las intermedias vienen llenas
        else:
            assert len(r["items"]) == total - page_size * (total_paginas - 1)
            assert len(r["items"]) >= 1  # nunca una última página vacía de más


def test_el_mismo_pedido_es_estable(client, H_ADMIN, seed):
    """Dos pedidos idénticos devuelven lo mismo (orden determinista)."""
    a = pedir(client, H_ADMIN, seed, page=3, page_size=5)
    b = pedir(client, H_ADMIN, seed, page=3, page_size=5)
    assert a == b


def test_cada_item_trae_los_datos_del_checklist_correcto(client, H_ADMIN, seed):
    por_id = {c.id: c for c in seed.checklists}

    items, _ = recorrer(client, H_ADMIN, seed, page_size=10)

    assert items
    for item in items:
        esperado = por_id[item["checklist_id"]]
        assert item["fecha"] == esperado.fecha.isoformat()
        assert item["equipo_id"] == esperado.equipo_id
        assert item["equipo_nombre"] == esperado.equipo_nombre
        assert item["total_tareas"] == esperado.total
        assert item["tareas_completadas"] == esperado.completadas
        assert item["porcentaje_cumplimiento"] == pytest.approx(esperado.porcentaje)
        assert sorted(t["nombre"] for t in item["tareas_incumplidas"]) == sorted(
            esperado.incumplidas
        )
        assert all(t["tarea_id"] is None for t in item["tareas_incumplidas"])


# ---------------------------------------------------------------------------
# 3. Filtros y bordes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("equipo", ["equipo_a", "equipo_b"])
def test_filtro_por_equipo_pagina_solo_ese_equipo(client, H_ADMIN, seed, equipo):
    equipo_id = getattr(seed, equipo)
    esperados = [c.id for c in seed.en_rango(seed.desde, seed.hasta, equipo_id)]
    assert esperados  # la guarda de que el caso ejercita algo

    items, respuestas = recorrer(client, H_ADMIN, seed, 5, equipo_id=equipo_id)

    assert [i["checklist_id"] for i in items] == esperados
    assert {i["equipo_id"] for i in items} == {equipo_id}
    assert {r["total"] for r in respuestas} == {len(esperados)}


def test_equipo_sin_checklists_devuelve_pagina_vacia_valida(client, H_ADMIN, seed):
    r = pedir(client, H_ADMIN, seed, page=1, page_size=5, equipo_id=seed.equipo_vacio)

    assert r["items"] == []
    assert r["total"] == 0
    assert r["total_paginas"] == 1  # nunca 0: el componente Paginacion lo espera
    assert r["porcentaje_cumplimiento_general"] == 0.0


def test_el_rango_de_fechas_es_inclusivo_y_excluye_lo_viejo(client, H_ADMIN, seed):
    # Rango parcial: del día -3 al día -1 (ambos extremos incluidos).
    desde, hasta = seed.hoy - timedelta(days=3), seed.hoy - timedelta(days=1)
    esperados = [c.id for c in seed.en_rango(desde, hasta)]
    assert esperados  # la guarda de que el caso ejercita algo

    items, _ = recorrer(client, H_ADMIN, seed, 3, desde=desde, hasta=hasta)

    assert [i["checklist_id"] for i in items] == esperados
    assert {i["fecha"] for i in items} == {
        (seed.hoy - timedelta(days=d)).isoformat() for d in (1, 2, 3)
    }


def test_un_solo_dia_con_varios_checklists_se_pagina_por_id_desc(client, H_ADMIN, seed):
    """Caso crítico del desempate: misma fecha, página que corta a la mitad."""
    esperados = [c.id for c in seed.en_rango(seed.hoy, seed.hoy)]
    assert len(esperados) == 4  # 2 equipos x 2 planes

    items, respuestas = recorrer(client, H_ADMIN, seed, 3, desde=seed.hoy, hasta=seed.hoy)

    assert [len(r["items"]) for r in respuestas] == [3, 1]
    assert [i["checklist_id"] for i in items] == esperados
    assert esperados == sorted(esperados, reverse=True)


def test_rango_sin_datos(client, H_ADMIN, seed):
    lejos = seed.hoy - timedelta(days=5000)
    r = pedir(client, H_ADMIN, seed, page=1, page_size=5, desde=lejos, hasta=lejos)

    assert r["items"] == []
    assert r["total"] == 0
    assert r["total_paginas"] == 1
    assert r["porcentaje_cumplimiento_general"] == 0.0


@pytest.mark.parametrize("page_size", [5, 10, 48])
def test_pagina_fuera_de_rango_devuelve_items_vacios_y_total_intacto(
    client, H_ADMIN, seed, page_size
):
    """Contrato en el que se apoya el frontend: con `items` vacíos y total > 0
    vuelve a la última página válida (`total_paginas`)."""
    total = len(seed.en_rango(seed.desde, seed.hasta))
    r = pedir(client, H_ADMIN, seed, page=999_999, page_size=page_size)

    assert r["items"] == []
    assert r["total"] == total
    assert r["total_paginas"] == math.ceil(total / page_size)
    assert r["page"] == 999_999

    # ...y esa "última página válida" efectivamente trae filas.
    ultima = pedir(client, H_ADMIN, seed, page=r["total_paginas"], page_size=page_size)
    assert len(ultima["items"]) >= 1


def test_la_pagina_justo_despues_de_la_ultima_esta_vacia(client, H_ADMIN, seed):
    total = len(seed.en_rango(seed.desde, seed.hasta))  # 48
    r = pedir(client, H_ADMIN, seed, page=total // 6 + 1, page_size=6)  # 48/6 = 8 -> 9
    assert r["items"] == []
    assert r["total"] == total


# ---------------------------------------------------------------------------
# 4. El % general no depende de la página
# ---------------------------------------------------------------------------


def test_porcentaje_general_es_el_del_periodo_completo_en_cualquier_pagina(
    client, H_ADMIN, seed
):
    filas = seed.en_rango(seed.desde, seed.hasta)
    esperado = seed.porcentaje_general(filas)  # ponderado por tareas

    for page_size in (1, 5, 7, 48, 100):
        _, respuestas = recorrer(client, H_ADMIN, seed, page_size)
        for r in respuestas:
            assert r["porcentaje_cumplimiento_general"] == pytest.approx(esperado)


def test_porcentaje_general_respeta_el_filtro_de_equipo(client, H_ADMIN, seed):
    for equipo_id in (seed.equipo_a, seed.equipo_b):
        filas = seed.en_rango(seed.desde, seed.hasta, equipo_id)
        r = pedir(client, H_ADMIN, seed, page=2, page_size=5, equipo_id=equipo_id)
        assert r["porcentaje_cumplimiento_general"] == pytest.approx(
            seed.porcentaje_general(filas)
        )


def test_porcentaje_general_respeta_el_rango_de_fechas(client, H_ADMIN, seed):
    desde, hasta = seed.hoy - timedelta(days=5), seed.hoy - timedelta(days=2)
    filas = seed.en_rango(desde, hasta)
    r = pedir(client, H_ADMIN, seed, page=1, page_size=3, desde=desde, hasta=hasta)
    assert r["porcentaje_cumplimiento_general"] == pytest.approx(
        seed.porcentaje_general(filas)
    )


# ---------------------------------------------------------------------------
# Compatibilidad: sin `page` sigue devolviendo todo el rango
# ---------------------------------------------------------------------------


def test_sin_page_devuelve_la_respuesta_completa_y_coincide_con_las_paginas(
    client, H_ADMIN, seed
):
    completa = pedir(client, H_ADMIN, seed)  # sin page

    assert "items" not in completa and "total_paginas" not in completa
    assert len(completa["checklists"]) == len(seed.en_rango(seed.desde, seed.hasta))

    items, respuestas = recorrer(client, H_ADMIN, seed, 7)
    # El listado completo ordena solo por fecha: se compara como conjunto.
    assert {c["checklist_id"] for c in completa["checklists"]} == {
        i["checklist_id"] for i in items
    }
    assert completa["porcentaje_cumplimiento_general"] == pytest.approx(
        respuestas[0]["porcentaje_cumplimiento_general"]
    )


# ---------------------------------------------------------------------------
# 5. El recorte lo hace la BASE (se mira el SQL real de la request)
# ---------------------------------------------------------------------------


def _principal(sentencias):
    """La consulta principal del listado: SELECT sobre `checklists` con LIMIT."""
    return [
        (s, p) for s, p in sentencias
        if re.search(r"\bFROM checklists\b", s)
        and "LIMIT" in s
        and "count(" not in s.lower()
    ]


@pytest.mark.parametrize("pagina", [1, 3, 10])
def test_la_consulta_principal_tiene_limit_offset_y_orden_con_desempate(
    client, H_ADMIN, seed, engine, pagina
):
    page_size = 5
    with capturar_sql(engine) as sentencias:
        pedir(client, H_ADMIN, seed, page=pagina, page_size=page_size)

    principales = _principal(sentencias)
    assert len(principales) == 1, "tiene que haber UNA consulta principal con LIMIT"
    sql, params = principales[0]

    assert "OFFSET" in sql
    # Desempate por id: sin él, OFFSET/LIMIT puede repetir u omitir filas.
    assert re.search(
        r"ORDER BY checklists\.fecha DESC,\s*checklists\.id DESC", sql
    ), sql

    filas = filas_que_devuelve(engine, sql, params)
    esperadas = min(page_size, max(0, 48 - page_size * (pagina - 1)))
    assert filas == esperadas  # la BASE devolvió solo esa página


def test_el_total_sale_de_un_count_en_sql_sin_order_by(client, H_ADMIN, seed, engine):
    with capturar_sql(engine) as sentencias:
        pedir(client, H_ADMIN, seed, page=1, page_size=5)

    counts = [
        s for s, _ in sentencias
        if "count(*)" in s.lower() and "FROM (SELECT" in s
    ]
    assert len(counts) == 1
    # Contar no necesita ordenar: `paginar` usa order_by(None).
    assert "ORDER BY" not in counts[0]


@pytest.mark.parametrize("page_size", [3, 5])
def test_los_selectinload_solo_cargan_las_filas_de_la_pagina(
    client, H_ADMIN, seed, engine, page_size
):
    """Si alguien vuelve a recortar en Python, los `IN (...)` de registros y
    equipos recibirían los ids de TODO el rango (48), no los de la página."""
    with capturar_sql(engine) as sentencias:
        pedir(client, H_ADMIN, seed, page=2, page_size=page_size)

    largos = [
        len(grupo.split(","))
        for s, _ in sentencias
        for grupo in re.findall(r"IN \(([^)]*)\)", s)
        if "?" in grupo
    ]
    assert largos, "se esperaba al menos un selectinload (registros)"
    assert max(largos) <= page_size


def test_el_porcentaje_general_es_un_agregado_en_sql(client, H_ADMIN, seed, engine):
    with capturar_sql(engine) as sentencias:
        pedir(client, H_ADMIN, seed, page=1, page_size=5)

    agregados = [
        s for s, _ in sentencias
        if "sum(" in s.lower() and "registro_tareas" in s and " IN (" not in s
    ]
    assert len(agregados) == 1


def test_la_cantidad_de_consultas_no_crece_con_el_tamano_de_pagina(
    client, H_ADMIN, seed, engine
):
    """Guarda contra N+1: pedir 50 filas cuesta las mismas consultas que 2."""
    cantidades = {}
    for page_size in (2, 50):
        with capturar_sql(engine) as sentencias:
            pedir(client, H_ADMIN, seed, page=1, page_size=page_size)
        cantidades[page_size] = len(sentencias)

    assert cantidades[2] == cantidades[50], cantidades


# ---------------------------------------------------------------------------
# 6. Validación de parámetros y permisos
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "extra",
    [
        {"page": 0},
        {"page": -1},
        {"page": 1, "page_size": 0},
        {"page": 1, "page_size": PAGE_SIZE_MAXIMO + 1},
        {"page": "abc"},
    ],
)
def test_parametros_de_paginacion_invalidos_dan_422(client, H_ADMIN, seed, extra):
    params = {
        "fecha_desde": seed.desde.isoformat(),
        "fecha_hasta": seed.hasta.isoformat(),
        **extra,
    }
    assert client.get(URL, params=params, headers=H_ADMIN).status_code == 422


def test_page_size_maximo_es_aceptado(client, H_ADMIN, seed):
    r = pedir(client, H_ADMIN, seed, page=1, page_size=PAGE_SIZE_MAXIMO)
    assert r["page_size"] == PAGE_SIZE_MAXIMO


@pytest.mark.parametrize("con_page", [True, False])
def test_rango_invertido_da_400(client, H_ADMIN, seed, con_page):
    params = {
        "fecha_desde": seed.hasta.isoformat(),
        "fecha_hasta": seed.desde.isoformat(),
    }
    if con_page:
        params.update(page=1, page_size=5)
    r = client.get(URL, params=params, headers=H_ADMIN)
    assert r.status_code == 400
    assert r.json()["detail"] == ErrorCode.FECHA_INVALIDA


def test_las_fechas_son_obligatorias(client, H_ADMIN):
    assert client.get(URL, params={"page": 1}, headers=H_ADMIN).status_code == 422


def test_sin_sesion_da_401(client, seed):
    params = {"fecha_desde": seed.desde.isoformat(), "fecha_hasta": seed.hasta.isoformat()}
    assert client.get(URL, params=params).status_code == 401


def test_un_operador_sin_permiso_de_administrar_da_403(client, usuarios, seed):
    params = {
        "fecha_desde": seed.desde.isoformat(),
        "fecha_hasta": seed.hasta.isoformat(),
        "page": 1,
    }
    r = client.get(URL, params=params, headers=usuarios["operador"])
    assert r.status_code == 403
