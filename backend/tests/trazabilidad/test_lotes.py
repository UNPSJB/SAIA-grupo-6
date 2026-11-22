import re
from datetime import date, timedelta
from decimal import Decimal

import pytest

from tests.produccion_helpers import completar_tarea, registrar_lo_planificado
from src.lotes import exceptions, schemas, services
from src.lotes.constants import ESTADO_CANCELADO, ESTADO_EN_PROCESO, ESTADO_TERMINADO
from src.lotes.models import ChecklistProduccion, ConsumoInsumo, LoteProducto
from src.recetas import services as recetas_services
from src.unidadMedida.models import UnidadMedida

from .conftest import receta_datos


def _crear(escenario, objetivo="40"):
    return services.crear_lote(
        escenario.db,
        schemas.LoteCreate(producto_id=escenario.pan.id, cantidad_objetivo=Decimal(objetivo)),
        escenario.admin,
    )


def _consumir(escenario, lote, indice_item, lote_insumo, cantidad, tipo="real", usuario=None):
    item = sorted(lote.checklist, key=lambda i: i.tarea.orden)[indice_item]
    return services.registrar_consumo(
        escenario.db,
        lote.id,
        item.id,
        schemas.ConsumoCreate(lote_insumo_id=lote_insumo.id, cantidad=Decimal(cantidad), tipo=tipo),
        usuario or escenario.operador,
    )


def _completar_todo(escenario, lote):
    for item in lote.checklist:
        completar_tarea(escenario.db, lote.id, item.id, escenario.operador)


def test_crear_lote_queda_en_proceso_y_genera_el_checklist_de_la_version_vigente(escenario):
    lote = _crear(escenario)

    assert lote.estado == ESTADO_EN_PROCESO
    assert lote.version_receta_id == escenario.version1.id
    assert lote.creado_por_id == escenario.admin.id
    assert [i.tarea.descripcion for i in sorted(lote.checklist, key=lambda i: i.tarea.orden)] == [
        "Amasar",
        "Condimentar",
    ]
    assert all(i.completado_en is None and i.completado_por_id is None for i in lote.checklist)


def test_el_numero_de_lote_es_unico_y_correlativo_por_dia(escenario):
    primero = _crear(escenario)
    segundo = _crear(escenario)

    patron = re.compile(r"^LP-\d{8}-\d{3}$")
    assert patron.match(primero.numero_lote) and patron.match(segundo.numero_lote)
    assert primero.numero_lote[:-3] == segundo.numero_lote[:-3]
    assert primero.numero_lote.endswith("-001")
    assert segundo.numero_lote.endswith("-002")


def test_cantidad_objetivo_define_el_factor_de_escala(escenario):
    lote = _crear(escenario, objetivo="40")

    assert lote.cantidad_objetivo == Decimal("40")
    assert lote.factor_escala == Decimal("2")


def test_la_version_del_lote_no_cambia_aunque_se_modifique_la_receta(escenario):
    db = escenario.db
    lote = _crear(escenario)
    version_original = lote.version_receta_id

    version2 = recetas_services.crear_version(
        db,
        escenario.receta.id,
        receta_datos(
            escenario,
            harina_total="15",
            tareas=[
                {"descripcion": "Amasar v2", "ingredientes": [{"ingrediente_id": escenario.harina.id, "cantidad": "15"}]},
                {"descripcion": "Condimentar v2", "ingredientes": [{"ingrediente_id": escenario.sal.id, "cantidad": "2"}]},
                {"descripcion": "Hornear", "ingredientes": []},
            ],
        ),
        escenario.admin,
    )

    relectura = services.obtener_lote(db, lote.id)
    assert version2.id != version_original
    assert relectura.version_receta_id == version_original
    assert [i.tarea.descripcion for i in relectura.checklist] == ["Amasar", "Condimentar"]

    lote_nuevo = _crear(escenario)
    assert lote_nuevo.version_receta_id == version2.id
    assert len(lote_nuevo.checklist) == 3


def test_producto_sin_receta_no_puede_producirse(escenario):
    from src.productos.models import Producto

    otro = Producto(nombre="Sin receta", unidad_medida_id=escenario.kg.id)
    escenario.db.add(otro)
    escenario.db.commit()

    with pytest.raises(exceptions.ProductoSinReceta):
        services.crear_lote(
            escenario.db,
            schemas.LoteCreate(producto_id=otro.id, cantidad_objetivo=Decimal("1")),
            escenario.admin,
        )


def test_completar_item_guarda_usuario_y_hora(escenario):
    lote = _crear(escenario)
    item = lote.checklist[0]

    lote = completar_tarea(escenario.db, lote.id, item.id, escenario.operador)

    hecho = next(i for i in lote.checklist if i.id == item.id)
    assert hecho.completado_por_id == escenario.operador.id
    assert hecho.completado_en is not None
    with pytest.raises(exceptions.ItemYaCompletado):
        services.completar_item(escenario.db, lote.id, item.id, escenario.operador)


def test_registrar_consumo_vincula_tarea_y_lote_de_insumo(escenario):
    lote = _crear(escenario)

    consumo, advertencias = _consumir(escenario, lote, 0, escenario.lote_harina, "20")

    assert advertencias == []
    assert consumo.tipo == "real"
    assert consumo.lote_insumo_id == escenario.lote_harina.id
    assert consumo.checklist.lote_producto_id == lote.id
    assert consumo.registrado_por_id == escenario.operador.id
    assert not hasattr(ConsumoInsumo, "lote_producto_id")


def test_consumo_de_ingrediente_que_la_tarea_no_usa_se_rechaza(escenario):
    lote = _crear(escenario)

    with pytest.raises(exceptions.IngredienteNoPrevisto):
        _consumir(escenario, lote, 0, escenario.lote_sal, "1")


def test_no_se_consume_mas_que_el_saldo_del_lote(escenario):
    db = escenario.db
    lote = _crear(escenario, objetivo="400")
    # La sal va en la segunda etapa: primero se completa la primera.
    completar_tarea(db, lote.id, sorted(lote.checklist, key=lambda i: i.tarea.orden)[0].id, escenario.operador)
    antes = db.query(ConsumoInsumo).count()

    # El lote de sal tiene 5 kg: 8 no se pueden sacar de ahí.
    with pytest.raises(exceptions.StockInsuficiente, match="quedan 5"):
        _consumir(escenario, lote, 1, escenario.lote_sal, "8")
    assert db.query(ConsumoInsumo).count() == antes

    # Todo el saldo sí; después, ni un gramo más (tampoco como desperdicio).
    assert _consumir(escenario, lote, 1, escenario.lote_sal, "5")[0].id
    with pytest.raises(exceptions.StockInsuficiente):
        _consumir(escenario, lote, 1, escenario.lote_sal, "0.001", tipo="desperdicio")


def test_cada_tarea_del_lote_muestra_el_procedimiento_de_su_version(escenario):
    """El procedimiento se escribe en la receta y viaja a cada lote con la
    versión que fijó: una versión nueva no cambia el de los lotes ya hechos."""
    db = escenario.db
    recetas_services.crear_version(
        db,
        escenario.receta.id,
        receta_datos(
            escenario,
            tareas=[
                {
                    "descripcion": "Amasar",
                    "procedimiento": "  1. Tamizar.\n2. Amasar 10 minutos.  ",
                    "ingredientes": [{"ingrediente_id": escenario.harina.id, "cantidad": "10"}],
                },
                {"descripcion": "Condimentar", "procedimiento": "   ",
                 "ingredientes": [{"ingrediente_id": escenario.sal.id, "cantidad": "2"}]},
            ],
        ),
        escenario.admin,
    )
    lote = _crear(escenario)

    amasar, condimentar = services.detalle(db, lote).checklist
    assert amasar.procedimiento == "1. Tamizar.\n2. Amasar 10 minutos."
    # Vacío o solo espacios: sin procedimiento.
    assert condimentar.procedimiento is None

    recetas_services.crear_version(db, escenario.receta.id, receta_datos(escenario), escenario.admin)
    assert services.detalle(db, services.obtener_lote(db, lote.id)).checklist[0].procedimiento == (
        "1. Tamizar.\n2. Amasar 10 minutos."
    )


def test_no_se_registra_una_etapa_con_la_anterior_pendiente(escenario):
    lote = _crear(escenario)
    amasar, condimentar = sorted(lote.checklist, key=lambda i: i.tarea.orden)

    with pytest.raises(exceptions.EtapaAnteriorPendiente, match="etapa 1"):
        _consumir(escenario, lote, 1, escenario.lote_sal, "1")
    with pytest.raises(exceptions.EtapaAnteriorPendiente):
        services.completar_item(escenario.db, lote.id, condimentar.id, escenario.admin)

    # Completada la primera, la segunda ya se puede registrar.
    completar_tarea(escenario.db, lote.id, amasar.id, escenario.operador)
    assert _consumir(escenario, lote, 1, escenario.lote_sal, "1")[0].id


def test_consumo_mayor_a_lo_planificado_advierte(escenario):
    lote = _crear(escenario, objetivo="20")

    _, advertencias = _consumir(escenario, lote, 0, escenario.lote_harina, "11")

    assert any("supera lo planificado" in a for a in advertencias)


def test_desperdicio_no_cuenta_como_exceso_sobre_lo_planificado(escenario):
    lote = _crear(escenario, objetivo="20")

    _, advertencias = _consumir(escenario, lote, 0, escenario.lote_harina, "3", tipo="desperdicio")

    assert advertencias == []


def test_lote_de_insumo_dado_de_baja_no_se_puede_consumir(escenario):
    from src.lotesInsumo import schemas as lotes_insumo_schemas
    from src.lotesInsumo import services as lotes_insumo_services

    lote = _crear(escenario)
    lotes_insumo_services.dar_de_baja_lote_insumo(
        escenario.db, escenario.lote_harina.id, lotes_insumo_schemas.LoteInsumoBaja(motivo="vencido"), escenario.admin
    )

    with pytest.raises(exceptions.LoteInsumoDadoDeBaja):
        _consumir(escenario, lote, 0, escenario.lote_harina, "1")


def test_un_lote_de_insumo_vencido_no_se_usa(escenario):
    from src.lotesInsumo.models import LoteInsumo

    lote_insumo = LoteInsumo(
        insumo_id=escenario.insumo_harina.id,
        ingrediente_id=escenario.harina.id,
        proveedor_id=escenario.molino.id,
        numero_lote="H-VIEJO",
        cantidad_recibida=Decimal("10"),
        fecha_ingreso=date.today() - timedelta(days=60),
        fecha_vencimiento=date.today() - timedelta(days=1),
    )
    escenario.db.add(lote_insumo)
    escenario.db.commit()
    lote = _crear(escenario)

    with pytest.raises(exceptions.LoteInsumoVencido, match="H-VIEJO"):
        _consumir(escenario, lote, 0, lote_insumo, "1")
    with pytest.raises(exceptions.LoteInsumoVencido):
        _consumir(escenario, lote, 0, lote_insumo, "1", tipo="desperdicio")

    # Un consumo de un lote que venció después: se puede bajar, no subir.
    consumo, _ = _consumir(escenario, lote, 0, escenario.lote_harina, "3")
    escenario.lote_harina.fecha_vencimiento = date.today() - timedelta(days=1)
    escenario.db.commit()
    services.modificar_consumo(
        escenario.db, lote.id, consumo.id, schemas.ConsumoUpdate(cantidad=Decimal("2")), escenario.operador
    )
    with pytest.raises(exceptions.LoteInsumoVencido):
        services.modificar_consumo(
            escenario.db, lote.id, consumo.id, schemas.ConsumoUpdate(cantidad=Decimal("4")), escenario.operador
        )


def test_cerrar_exige_checklist_completo_y_cantidad_producida(escenario):
    lote = _crear(escenario)

    with pytest.raises(exceptions.ChecklistIncompleto):
        services.cerrar_lote(escenario.db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38")))

    _completar_todo(escenario, lote)
    cerrado = services.cerrar_lote(
        escenario.db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38"))
    )

    assert cerrado.estado == ESTADO_TERMINADO
    assert cerrado.cantidad_producida == Decimal("38")
    assert cerrado.fecha_cierre is not None


def test_producto_por_unidad_se_elabora_en_cantidades_enteras(escenario):
    """No hay 66,105 panes: ni de objetivo, ni multiplicando la receta, ni al cerrar."""
    db = escenario.db
    escenario.pan.unidad_medida = UnidadMedida(
        nombre="Unidad", simbolo="un", tipo="unidad", factor_a_base=1
    )
    db.commit()

    with pytest.raises(exceptions.CantidadObjetivoNoEntera):
        _crear(escenario, objetivo="40.5")
    with pytest.raises(exceptions.CantidadObjetivoNoEntera):
        # La receta rinde 20: ×1,33 serían 26,6 panes.
        services.crear_lote(
            db, schemas.LoteCreate(producto_id=escenario.pan.id, factor=Decimal("1.33")), escenario.admin
        )

    lote = _crear(escenario, objetivo="40")
    _completar_todo(escenario, lote)
    with pytest.raises(exceptions.CantidadProducidaNoEntera):
        services.cerrar_lote(db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38.5")))
    cerrado = services.cerrar_lote(db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38")))
    assert cerrado.cantidad_producida == Decimal("38")


def test_producto_por_peso_admite_fracciones(escenario):
    escenario.pan.unidad_medida.tipo = "masa"
    escenario.pan.unidad_medida.factor_a_base = 1000
    escenario.db.commit()

    lote = _crear(escenario, objetivo="40.5")
    _completar_todo(escenario, lote)
    cerrado = services.cerrar_lote(
        escenario.db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("38.25"))
    )
    assert cerrado.cantidad_producida == Decimal("38.25")


def test_cancelar_guarda_el_motivo(escenario):
    lote = _crear(escenario)

    cancelado = services.cancelar_lote(escenario.db, lote.id, "Falla del horno")

    assert cancelado.estado == ESTADO_CANCELADO
    assert cancelado.motivo_cancelacion == "Falla del horno"


@pytest.mark.parametrize("cierre", ["terminar", "cancelar"])
def test_lote_cerrado_es_de_solo_lectura_en_los_services(escenario, cierre):
    lote = _crear(escenario)
    item = lote.checklist[0]
    _completar_todo(escenario, lote)
    if cierre == "terminar":
        services.cerrar_lote(escenario.db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("1")))
    else:
        # Un lote con checklist completo también puede cancelarse.
        services.cancelar_lote(escenario.db, lote.id, "Error de carga")

    with pytest.raises(exceptions.LoteCerrado):
        services.completar_item(escenario.db, lote.id, item.id, escenario.operador)
    with pytest.raises(exceptions.LoteCerrado):
        _consumir(escenario, services.obtener_lote(escenario.db, lote.id), 0, escenario.lote_harina, "1")
    with pytest.raises(exceptions.LoteCerrado):
        services.cerrar_lote(escenario.db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("1")))
    with pytest.raises(exceptions.LoteCerrado):
        services.cancelar_lote(escenario.db, lote.id, "Otra vez")


@pytest.mark.parametrize("cierre", ["terminar", "cancelar"])
def test_lote_cerrado_no_se_edita_ni_saltando_el_service(escenario, cierre):
    """Respaldo en el ORM: tocar el lote, su checklist o sus consumos falla."""
    db = escenario.db
    lote = _crear(escenario)
    consumo, _ = _consumir(escenario, lote, 0, escenario.lote_harina, "5")
    _completar_todo(escenario, lote)
    if cierre == "terminar":
        services.cerrar_lote(db, lote.id, schemas.LoteCierre(cantidad_producida=Decimal("1")))
    else:
        services.cancelar_lote(db, lote.id, "Error de carga")

    lote = db.get(LoteProducto, lote.id)
    lote.cantidad_objetivo = Decimal("999")
    with pytest.raises(exceptions.LoteCerradoError):
        db.commit()
    db.rollback()

    item = db.query(ChecklistProduccion).filter_by(lote_producto_id=lote.id).first()
    item.completado_por_id = escenario.admin.id
    with pytest.raises(exceptions.LoteCerradoError):
        db.commit()
    db.rollback()

    db.add(
        ConsumoInsumo(
            checklist_produccion_id=item.id,
            lote_insumo_id=escenario.lote_harina.id,
            cantidad=Decimal("1"),
        )
    )
    with pytest.raises(exceptions.LoteCerradoError):
        db.commit()
    db.rollback()

    db.delete(db.get(ConsumoInsumo, consumo.id))
    with pytest.raises(exceptions.LoteCerradoError):
        db.commit()
    db.rollback()


# --------------------------------------------------------------------------
# API y permisos
# --------------------------------------------------------------------------

def test_api_crear_lote_requiere_permiso_de_operar(client, escenario):
    """E9: quien opera inicia el lote desde la receta escalada."""
    cuerpo = {"producto_id": escenario.pan.id, "cantidad_objetivo": "40"}

    assert client.post("/lotes", json=cuerpo, headers=escenario.h_sin_permisos).status_code == 403
    assert client.post("/lotes", json=cuerpo).status_code == 401

    respuesta = client.post("/lotes", json=cuerpo, headers=escenario.h_operador)

    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["estado"] == "en_proceso"
    assert datos["version_numero"] == 1
    assert [i["descripcion"] for i in datos["checklist"]] == ["Amasar", "Condimentar"]
    assert datos["checklist"][0]["ingredientes"][0]["cantidad_planificada"] == "20.000"


def test_api_el_operador_completa_el_checklist_y_registra_consumos(client, escenario):
    lote = client.post(
        "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "40"},
        headers=escenario.h_admin,
    ).json()
    item_id = lote["checklist"][0]["id"]

    consumo = client.post(
        f"/lotes/{lote['id']}/checklist/{item_id}/consumos",
        json={"lote_insumo_id": escenario.lote_harina.id, "cantidad": "20"},
        headers=escenario.h_operador,
    )
    assert consumo.status_code == 201
    assert consumo.json()["proveedor_nombre"] == "Molino Sur"
    assert consumo.json()["advertencias"] == []

    hecho = client.post(
        f"/lotes/{lote['id']}/checklist/{item_id}/completar", headers=escenario.h_operador
    )
    assert hecho.status_code == 200
    item = hecho.json()["checklist"][0]
    assert item["completado"] is True
    assert item["completado_por_id"] == escenario.operador.id
    assert item["ingredientes"][0]["consumo_real"] == "20.000"


def test_api_consumo_con_stock_insuficiente_responde_400(client, escenario):
    lote = client.post(
        "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "400"},
        headers=escenario.h_admin,
    ).json()
    primera, segunda = sorted(lote["checklist"], key=lambda i: i["orden"])
    completar_tarea(escenario.db, lote["id"], primera["id"], escenario.operador)
    item_id = segunda["id"]

    respuesta = client.post(
        f"/lotes/{lote['id']}/checklist/{item_id}/consumos",
        json={"lote_insumo_id": escenario.lote_sal.id, "cantidad": "8"},
        headers=escenario.h_operador,
    )

    assert respuesta.status_code == 400
    assert "no tiene saldo suficiente" in respuesta.json()["detail"]


def test_api_cancelar_es_solo_de_administradores_y_pide_motivo(client, escenario):
    lote = client.post(
        "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "40"},
        headers=escenario.h_admin,
    ).json()
    url = f"/lotes/{lote['id']}/cancelar"

    assert client.post(url, json={"motivo": "x"}, headers=escenario.h_operador).status_code == 403
    assert client.post(url, json={"motivo": "  "}, headers=escenario.h_admin).status_code == 400

    respuesta = client.post(url, json={"motivo": "Cliente canceló"}, headers=escenario.h_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "cancelado"
    cerrado = client.post(
        f"/lotes/{lote['id']}/checklist/{lote['checklist'][0]['id']}/completar",
        headers=escenario.h_operador,
    )
    assert cerrado.status_code == 400


def test_api_lote_cerrado_se_consulta_en_solo_lectura(client, escenario):
    lote = client.post(
        "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "40"},
        headers=escenario.h_admin,
    ).json()
    for item in lote["checklist"]:
        registrar_lo_planificado(escenario.db, lote["id"], item["id"], escenario.operador)
        client.post(
            f"/lotes/{lote['id']}/checklist/{item['id']}/completar", headers=escenario.h_operador
        )
    cierre = client.post(
        f"/lotes/{lote['id']}/cerrar", json={"cantidad_producida": "39"}, headers=escenario.h_operador
    )
    assert cierre.status_code == 200

    lectura = client.get(f"/lotes/{lote['id']}", headers=escenario.h_operador)
    assert lectura.status_code == 200
    assert lectura.json()["estado"] == "terminado"
    assert client.post(
        f"/lotes/{lote['id']}/cerrar", json={"cantidad_producida": "1"}, headers=escenario.h_operador
    ).status_code == 400


def test_api_listado_y_dashboard(client, escenario):
    for _ in range(2):
        client.post(
            "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "40"},
            headers=escenario.h_admin,
        )

    listado = client.get("/lotes?estado=en_proceso", headers=escenario.h_operador)
    dashboard = client.get("/lotes/dashboard", headers=escenario.h_admin)

    assert listado.status_code == 200 and len(listado.json()) == 2
    assert dashboard.json()["total_lotes"] == 2
    assert {e["estado"]: e["cantidad"] for e in dashboard.json()["por_estado"]} == {
        "en_proceso": 2,
        "terminado": 0,
        "cancelado": 0,
    }
    assert client.get("/lotes/dashboard", headers=escenario.h_operador).status_code == 403


def test_api_dashboard_informa_la_unidad_de_cada_producto(client, escenario):
    """El gráfico de producción necesita la unidad de cada producto, y el
    total se da por unidad (no se suman kilos con unidades)."""
    lote = client.post(
        "/lotes", json={"producto_id": escenario.pan.id, "cantidad_objetivo": "40"},
        headers=escenario.h_admin,
    ).json()
    for item in lote["checklist"]:
        registrar_lo_planificado(escenario.db, lote["id"], item["id"], escenario.operador)
        client.post(
            f"/lotes/{lote['id']}/checklist/{item['id']}/completar", headers=escenario.h_operador
        )
    client.post(
        f"/lotes/{lote['id']}/cerrar", json={"cantidad_producida": "39"}, headers=escenario.h_operador
    )

    dashboard = client.get("/lotes/dashboard", headers=escenario.h_admin).json()

    assert dashboard["por_producto"] == [
        {"producto": "Pan casero", "cantidad_producida": "39.000", "cantidad_lotes": 1, "unidad": "kg"}
    ]
    assert dashboard["total_por_unidad"] == [{"unidad": "kg", "cantidad": "39.000"}]


def test_una_tarea_no_se_completa_sin_consumir_lo_que_pide_la_receta(escenario):
    lote = _crear(escenario)
    amasar = sorted(lote.checklist, key=lambda i: i.tarea.orden)[0]

    with pytest.raises(exceptions.ConsumoIncompleto) as error:
        services.completar_item(escenario.db, lote.id, amasar.id, escenario.operador)
    assert "Harina 000" in error.value.detail

    # El desperdicio no cuenta: lo que se tiró no entró en el producto.
    planificado = services._planificados_del_item(escenario.db, lote, amasar)[0].cantidad_planificada
    _consumir(escenario, lote, 0, escenario.lote_harina, str(planificado - 1))
    _consumir(escenario, lote, 0, escenario.lote_harina, "1", tipo="desperdicio")
    with pytest.raises(exceptions.ConsumoIncompleto):
        services.completar_item(escenario.db, lote.id, amasar.id, escenario.operador)

    _consumir(escenario, lote, 0, escenario.lote_harina, "1")
    hecho = services.completar_item(escenario.db, lote.id, amasar.id, escenario.operador)
    assert next(i for i in hecho.checklist if i.id == amasar.id).completado_en is not None

