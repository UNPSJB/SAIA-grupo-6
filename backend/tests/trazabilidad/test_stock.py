from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from src.lotes import schemas, services
from src.lotes.models import ConsumoInsumo
from src.lotesInsumo import exceptions, services as lotes_insumo_services
from src.lotesInsumo.models import LoteInsumo
from src.proveedores.models import Proveedor
from src.proveedores import services as proveedores_services


def _lote_con_consumos(escenario):
    db = escenario.db
    lote = services.crear_lote(
        db,
        schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal("40")),
        escenario.admin,
    )
    amasar = next(i for i in lote.checklist if i.tarea.orden == 1)
    for cantidad, tipo in (("18", "real"), ("2", "desperdicio")):
        services.registrar_consumo(
            db,
            lote.id,
            amasar.id,
            schemas.ConsumoCreate(
                lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal(cantidad), tipo=tipo
            ),
            escenario.operador,
        )
    return lote


def test_el_stock_no_es_una_columna():
    assert not hasattr(LoteInsumo, "stock")
    assert not hasattr(LoteInsumo, "saldo")
    assert "stock" not in LoteInsumo.__table__.columns
    assert "saldo" not in LoteInsumo.__table__.columns


def test_stock_sin_consumos_es_lo_recibido(escenario):
    stock = lotes_insumo_services.stock_por_lote(escenario.db, escenario.harina.id)

    assert [(s.numero_lote, s.saldo) for s in stock] == [("H-100", Decimal("50"))]


def test_stock_es_recibido_menos_consumo_real_menos_desperdicio(escenario):
    _lote_con_consumos(escenario)

    por_lote = lotes_insumo_services.stock_por_lote(escenario.db, escenario.harina.id)[0]
    por_insumo = lotes_insumo_services.stock_por_insumo(escenario.db, escenario.harina.id)[0]

    assert por_lote.cantidad_recibida == Decimal("50")
    assert por_lote.consumo_real == Decimal("18")
    assert por_lote.desperdicio == Decimal("2")
    assert por_lote.saldo == Decimal("30")
    assert por_insumo.stock == Decimal("30")
    assert por_insumo.unidad == "kg"


def test_el_stock_por_insumo_suma_sus_lotes(escenario):
    escenario.nuevo_lote_insumo(escenario.harina, escenario.salinas, "H-300", "25")
    _lote_con_consumos(escenario)

    stock = lotes_insumo_services.stock_por_insumo(escenario.db, escenario.harina.id)[0]

    assert stock.cantidad_recibida == Decimal("75")
    assert stock.stock == Decimal("55")


def test_stock_por_insumo_lista_todos_los_insumos(escenario):
    nombres = {s.insumo_nombre: s.stock for s in lotes_insumo_services.stock_por_insumo(escenario.db)}

    assert nombres == {"Harina 000": Decimal("50"), "Sal fina": Decimal("5")}


def test_un_lote_dado_de_baja_deja_de_contar_en_el_stock(escenario):
    lotes_insumo_services.dar_de_baja_lote_insumo(escenario.db, escenario.lote_harina.id, "Descarte")

    assert lotes_insumo_services.stock_por_insumo(escenario.db, escenario.harina.id)[0].stock == 0
    assert lotes_insumo_services.stock_por_lote(escenario.db, escenario.harina.id) == []
    historico = lotes_insumo_services.stock_por_lote(
        escenario.db, escenario.harina.id, incluir_inactivos=True
    )
    assert historico[0].activo is False
    with pytest.raises(exceptions.LoteYaDadoDeBaja):
        lotes_insumo_services.dar_de_baja_lote_insumo(escenario.db, escenario.lote_harina.id, "Otra")


def test_stock_vencido_se_informa_aparte(escenario):
    db = escenario.db
    db.add(
        LoteInsumo(
            insumo_id=escenario.harina.id,
            proveedor_id=escenario.molino.id,
            numero_lote="H-VIEJO",
            cantidad_recibida=Decimal("7"),
            fecha_ingreso=date.today() - timedelta(days=60),
            fecha_vencimiento=date.today() - timedelta(days=1),
        )
    )
    db.commit()

    stock = lotes_insumo_services.stock_por_insumo(db, escenario.harina.id)[0]

    assert stock.stock == Decimal("57")
    assert stock.stock_vencido == Decimal("7")


def test_lotes_sugeridos_por_vencimiento_y_sin_vencidos(escenario):
    db = escenario.db
    escenario.nuevo_lote_insumo(escenario.harina, escenario.salinas, "H-PRONTO", "5", date.today() + timedelta(days=10))
    escenario.nuevo_lote_insumo(escenario.harina, escenario.salinas, "H-SIN-FECHA", "5")
    db.add(
        LoteInsumo(
            insumo_id=escenario.harina.id,
            proveedor_id=escenario.molino.id,
            numero_lote="H-VENCIDO",
            cantidad_recibida=Decimal("5"),
            fecha_ingreso=date.today() - timedelta(days=60),
            fecha_vencimiento=date.today() - timedelta(days=1),
        )
    )
    db.commit()

    sugeridos = lotes_insumo_services.lotes_sugeridos(db, escenario.harina.id)

    assert [s.numero_lote for s in sugeridos] == ["H-PRONTO", "H-100", "H-SIN-FECHA"]


def test_lote_agotado_no_se_sugiere(escenario):
    _lote_con_consumos(escenario)
    lote = services.listar_lotes(escenario.db)[0]
    amasar = next(i for i in lote.checklist if i.tarea.orden == 1)
    services.registrar_consumo(
        escenario.db,
        lote.id,
        amasar.id,
        schemas.ConsumoCreate(lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal("30")),
        escenario.operador,
    )

    assert lotes_insumo_services.lotes_sugeridos(escenario.db, escenario.harina.id) == []


def test_lote_de_insumo_con_consumos_no_se_puede_borrar(escenario):
    db = escenario.db
    _lote_con_consumos(escenario)

    db.delete(db.get(LoteInsumo, escenario.lote_harina.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.get(LoteInsumo, escenario.lote_harina.id) is not None
    assert db.query(ConsumoInsumo).count() == 2


def test_proveedor_con_lotes_no_se_puede_borrar_pero_si_dar_de_baja(escenario):
    db = escenario.db
    _lote_con_consumos(escenario)

    db.delete(db.get(Proveedor, escenario.molino.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    baja = proveedores_services.eliminar_proveedor(db, escenario.molino.id)
    assert baja.activo is False
    assert lotes_insumo_services.obtener_lote_insumo(db, escenario.lote_harina.id).proveedor.nombre == "Molino Sur"


def test_no_se_pueden_recibir_lotes_de_un_proveedor_dado_de_baja(escenario):
    proveedores_services.eliminar_proveedor(escenario.db, escenario.salinas.id)

    with pytest.raises(exceptions.ProveedorNoEncontrado):
        escenario.nuevo_lote_insumo(escenario.sal, escenario.salinas, "S-999", "1")


def test_lote_duplicado_del_mismo_proveedor_se_rechaza(escenario):
    with pytest.raises(exceptions.LoteInsumoYaExiste):
        escenario.nuevo_lote_insumo(escenario.harina, escenario.molino, "H-100", "1")


def test_api_stock_y_lotes_de_insumo(client, escenario):
    _lote_con_consumos(escenario)

    por_insumo = client.get("/stock/insumos", headers=escenario.h_admin)
    por_lote = client.get(f"/stock/lotes-insumo?insumo_id={escenario.harina.id}", headers=escenario.h_admin)
    sugeridos = client.get(
        f"/lotes-insumo/sugeridos?insumo_id={escenario.harina.id}", headers=escenario.h_operador
    )

    assert {s["insumo_nombre"]: s["stock"] for s in por_insumo.json()}["Harina 000"] == "30.000"
    assert por_lote.json()[0]["saldo"] == "30.000"
    assert sugeridos.json()[0]["numero_lote"] == "H-100"
    assert client.get("/stock/insumos", headers=escenario.h_operador).status_code == 403


def test_api_recibir_y_dar_de_baja_un_lote_de_insumo(client, escenario):
    cuerpo = {
        "insumo_id": escenario.harina.id,
        "proveedor_id": escenario.molino.id,
        "numero_lote": " H-777 ",
        "cantidad_recibida": "10",
    }

    assert client.post("/lotes-insumo", json=cuerpo, headers=escenario.h_operador).status_code == 403
    creado = client.post("/lotes-insumo", json=cuerpo, headers=escenario.h_admin)
    assert creado.status_code == 201
    assert creado.json()["numero_lote"] == "H-777"
    assert creado.json()["proveedor"]["nombre"] == "Molino Sur"

    baja = client.post(
        f"/lotes-insumo/{creado.json()['id']}/baja", json={"motivo": "Vencido"}, headers=escenario.h_admin
    )
    assert baja.status_code == 200 and baja.json()["activo"] is False
    sin_motivo = client.post(
        f"/lotes-insumo/{escenario.lote_sal.id}/baja", json={"motivo": " "}, headers=escenario.h_admin
    )
    assert sin_motivo.status_code == 400
    assert client.delete(f"/lotes-insumo/{escenario.lote_sal.id}", headers=escenario.h_admin).json()["activo"] is False


def test_api_sugeridos_con_todos_incluye_vencidos_y_agotados(client, escenario):
    db = escenario.db
    db.add(
        LoteInsumo(
            insumo_id=escenario.harina.id,
            proveedor_id=escenario.molino.id,
            numero_lote="H-VENCIDO",
            cantidad_recibida=Decimal("5"),
            fecha_ingreso=date.today() - timedelta(days=60),
            fecha_vencimiento=date.today() - timedelta(days=1),
        )
    )
    db.commit()
    url = f"/lotes-insumo/sugeridos?insumo_id={escenario.harina.id}"

    disponibles = client.get(url, headers=escenario.h_operador).json()
    todos = client.get(url + "&todos=true", headers=escenario.h_operador).json()

    assert [l["numero_lote"] for l in disponibles] == ["H-100"]
    assert [l["numero_lote"] for l in todos] == ["H-VENCIDO", "H-100"]
    assert todos[0]["vencido"] is True
