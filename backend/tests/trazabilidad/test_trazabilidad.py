from decimal import Decimal

from src.lotes import schemas, services
from src.recetas import services as recetas_services
from src.trazabilidad import services as trazabilidad_services

from .conftest import receta_datos


def _producir(escenario, objetivo="40"):
    """Elabora un lote completo: harina en la tarea 1 y sal en la tarea 2."""
    db = escenario.db
    lote = services.crear_lote(
        db,
        schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal(objetivo)),
        escenario.admin,
    )
    amasar, condimentar = sorted(lote.checklist, key=lambda i: i.tarea.orden)

    def consumir(item, lote_insumo, cantidad, tipo="real"):
        services.registrar_consumo(
            db,
            lote.id,
            item.id,
            schemas.ConsumoCreate(lote_insumo_id=lote_insumo.id, cantidad=Decimal(cantidad), tipo=tipo),
            escenario.operador,
        )

    consumir(amasar, escenario.lote_harina, "19")
    consumir(amasar, escenario.lote_harina, "1", tipo="desperdicio")
    consumir(condimentar, escenario.lote_sal, "4")
    for item in (amasar, condimentar):
        services.completar_item(db, lote.id, item.id, escenario.operador)
    return services.cerrar_lote(db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38")))


def test_hacia_atras_del_lote_de_producto_al_proveedor(escenario):
    lote = _producir(escenario)

    traza = trazabilidad_services.trazar_lote_producto(escenario.db, lote.id)

    assert traza.lote.numero_lote == lote.numero_lote
    assert traza.lote.estado == "terminado"
    assert traza.elaborado_por.nombre == "Ada Admin"
    assert (traza.receta.version_numero, traza.receta.version_id) == (1, escenario.version1.id)
    assert [t.descripcion for t in traza.tareas] == ["Amasar", "Condimentar"]

    amasar, condimentar = traza.tareas
    assert amasar.completado_por.nombre == "Omar Operador"
    assert amasar.completado_en is not None
    assert [(c.tipo, c.cantidad) for c in amasar.consumos] == [
        ("real", Decimal("19")),
        ("desperdicio", Decimal("1")),
    ]
    assert amasar.consumos[0].lote_insumo.numero_lote == "H-100"
    assert amasar.consumos[0].lote_insumo.proveedor.nombre == "Molino Sur"
    assert condimentar.consumos[0].lote_insumo.proveedor.nombre == "Salinas del Norte"

    harina = amasar.planificado[0]
    assert (harina.cantidad_planificada, harina.consumo_real, harina.desperdicio) == (
        Decimal("20"), Decimal("19"), Decimal("1"),
    )
    assert {p.nombre for p in traza.proveedores} == {"Molino Sur", "Salinas del Norte"}
    assert {l.numero_lote for l in traza.lotes_insumo} == {"H-100", "S-200"}


def test_hacia_adelante_del_lote_de_insumo_a_los_lotes_de_producto(escenario):
    primero = _producir(escenario)
    segundo = _producir(escenario, objetivo="20")

    traza = trazabilidad_services.trazar_lote_insumo(escenario.db, escenario.lote_harina.id)

    assert traza.lote_insumo.proveedor.nombre == "Molino Sur"
    assert traza.cantidad_recibida == Decimal("50")
    assert [l.lote_producto_id for l in traza.lotes_producto] == [primero.id, segundo.id]
    assert traza.lotes_producto[0].consumo_real == Decimal("19")
    assert traza.lotes_producto[0].desperdicio == Decimal("1")
    assert traza.saldo == Decimal("50") - 2 * Decimal("20")


def test_ida_y_vuelta_cada_lote_de_insumo_apunta_al_lote_de_producto_que_lo_uso(escenario):
    lote = _producir(escenario)

    atras = trazabilidad_services.trazar_lote_producto(escenario.db, lote.id)

    for lote_insumo in atras.lotes_insumo:
        adelante = trazabilidad_services.trazar_lote_insumo(escenario.db, lote_insumo.id)
        assert lote.id in [l.lote_producto_id for l in adelante.lotes_producto]
        assert adelante.lote_insumo.proveedor.id == lote_insumo.proveedor.id


def test_la_trazabilidad_conserva_la_version_original_tras_modificar_la_receta(escenario):
    lote = _producir(escenario)
    recetas_services.crear_version(
        escenario.db,
        escenario.receta.id,
        receta_datos(
            escenario,
            harina_total="30",
            tareas=[
                {"descripcion": "Nueva tarea", "insumos": [{"insumo_id": escenario.harina.id, "cantidad": "30"}]},
                {"descripcion": "Sal", "insumos": [{"insumo_id": escenario.sal.id, "cantidad": "2"}]},
            ],
        ),
        escenario.admin,
    )

    traza = trazabilidad_services.trazar_lote_producto(escenario.db, lote.id)

    assert traza.receta.version_numero == 1
    assert [t.descripcion for t in traza.tareas] == ["Amasar", "Condimentar"]


def test_los_lotes_cancelados_tambien_aparecen_hacia_adelante(escenario):
    db = escenario.db
    lote = services.crear_lote(
        db,
        schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal("40")),
        escenario.admin,
    )
    amasar = next(i for i in lote.checklist if i.tarea.orden == 1)
    services.registrar_consumo(
        db, lote.id, amasar.id,
        schemas.ConsumoCreate(lote_insumo_id=escenario.lote_harina.id, cantidad=Decimal("5")),
        escenario.operador,
    )
    services.cancelar_lote(db, lote.id, "Error")

    traza = trazabilidad_services.trazar_lote_insumo(db, escenario.lote_harina.id)

    assert [(l.numero_lote, l.estado) for l in traza.lotes_producto] == [(lote.numero_lote, "cancelado")]


def test_api_trazabilidad_ida_y_vuelta(client, escenario):
    lote = _producir(escenario)

    atras = client.get(f"/trazabilidad/lotes-producto/{lote.id}", headers=escenario.h_admin)
    assert atras.status_code == 200
    cuerpo = atras.json()
    assert cuerpo["receta"]["version_numero"] == 1
    proveedor = cuerpo["tareas"][0]["consumos"][0]["lote_insumo"]["proveedor"]
    assert proveedor["nombre"] == "Molino Sur"

    lote_insumo_id = cuerpo["tareas"][0]["consumos"][0]["lote_insumo"]["id"]
    adelante = client.get(
        f"/trazabilidad/lotes-insumo/{lote_insumo_id}/lotes-producto", headers=escenario.h_admin
    )
    assert adelante.status_code == 200
    assert adelante.json()["lotes_producto"][0]["numero_lote"] == lote.numero_lote


def test_api_trazabilidad_es_solo_para_administradores(client, escenario):
    lote = _producir(escenario)

    assert client.get(f"/trazabilidad/lotes-producto/{lote.id}", headers=escenario.h_operador).status_code == 403
    assert client.get("/trazabilidad/lotes-producto/9999", headers=escenario.h_admin).status_code == 404
    assert client.get("/trazabilidad/lotes-insumo/9999/lotes-producto", headers=escenario.h_admin).status_code == 404
