"""Consumos de una etapa: se corrigen o borran mientras la etapa está
pendiente; una etapa hecha queda cerrada."""

from decimal import Decimal

import pytest

from src.lotes import exceptions, schemas, services
from src.lotesInsumo.services import saldo_lote_insumo
from tests.produccion_helpers import completar_tarea

from .conftest import _usuario


def _lote_con_consumo(escenario, cantidad="3"):
    lote = services.crear_lote(
        escenario.db,
        schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal("40")),
        escenario.admin,
    )
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]
    consumo, _ = services.registrar_consumo(
        escenario.db, lote.id, amasar.id,
        schemas.ConsumoCreate(lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal(cantidad)),
        escenario.operador,
    )
    return lote, amasar, consumo


def test_corregir_la_cantidad_de_un_consumo(escenario):
    lote, _, consumo = _lote_con_consumo(escenario)

    services.modificar_consumo(
        escenario.db, lote.id, consumo.id, schemas.ConsumoUpdate(cantidad=Decimal("2.5")), escenario.operador
    )
    assert saldo_lote_insumo(escenario.db, escenario.lote_harina) == Decimal("47.5")
    # Hasta el saldo, contando lo que ya descontaba este consumo (50 en total).
    with pytest.raises(exceptions.StockInsuficiente, match="como máximo 50"):
        services.modificar_consumo(
            escenario.db, lote.id, consumo.id, schemas.ConsumoUpdate(cantidad=Decimal("51")), escenario.operador
        )


def test_borrar_un_consumo_devuelve_el_saldo(escenario):
    lote, _, consumo = _lote_con_consumo(escenario)

    lote = services.eliminar_consumo(escenario.db, lote.id, consumo.id, escenario.operador)
    assert saldo_lote_insumo(escenario.db, escenario.lote_harina) == Decimal("50")
    assert all(not item.consumos for item in lote.checklist)
    with pytest.raises(exceptions.ConsumoNoEncontrado):
        services.eliminar_consumo(escenario.db, lote.id, consumo.id, escenario.operador)


def test_una_etapa_hecha_queda_cerrada(escenario):
    lote, amasar, consumo = _lote_con_consumo(escenario)
    completar_tarea(escenario.db, lote.id, amasar.id, escenario.operador)

    with pytest.raises(exceptions.EtapaYaCompletada):
        services.registrar_consumo(
            escenario.db, lote.id, amasar.id,
            schemas.ConsumoCreate(lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal("1"),
                                  tipo="desperdicio"),
            escenario.operador,
        )
    with pytest.raises(exceptions.EtapaYaCompletada):
        services.modificar_consumo(
            escenario.db, lote.id, consumo.id, schemas.ConsumoUpdate(cantidad=Decimal("1")), escenario.operador
        )
    with pytest.raises(exceptions.EtapaYaCompletada):
        services.eliminar_consumo(escenario.db, lote.id, consumo.id, escenario.admin)


def test_no_corrige_quien_no_puede_registrar_la_etapa(escenario):
    otra, _ = _usuario(
        escenario.db, nombre="Olga", apellido="Otra", dni="10000004", email="olga@test.local",
        puede_administrar=False, puede_operar=True,
    )
    lote, amasar, consumo = _lote_con_consumo(escenario)
    services.asignar_tarea(
        escenario.db, lote.id, amasar.id, schemas.AsignacionTarea(asignado_a_id=otra.id), escenario.admin
    )

    with pytest.raises(exceptions.TareaAsignadaAOtro):
        services.eliminar_consumo(escenario.db, lote.id, consumo.id, escenario.operador)
    assert services.eliminar_consumo(escenario.db, lote.id, consumo.id, otra).id == lote.id


def test_api_corregir_y_borrar(client, escenario):
    lote, _, consumo = _lote_con_consumo(escenario)
    url = f"/lotes/{lote.id}/consumos/{consumo.id}"

    corregido = client.put(url, json={"cantidad": "1.5"}, headers=escenario.h_operador)
    assert corregido.status_code == 200
    assert corregido.json()["checklist"][0]["consumos"][0]["cantidad"] in ("1.5", "1.500")
    assert client.delete(url, headers=escenario.h_operador).status_code == 200
    assert client.delete(url, headers=escenario.h_operador).status_code == 404
