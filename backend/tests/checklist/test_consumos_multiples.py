"""Varios productos químicos (con su cantidad) y varios elementos por tarea."""

from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select, text

from src.checklist.models import RegistroTarea
from src.checklist.services.consumo import listar_consumo_insumos
from src.checklist.services.generacion import obtener_o_crear_checklists_del_dia
from src.checklist.services.historial import obtener_detalle_checklist
from src.checklist.services.marcado import marcar_tarea
from src.checklist.services.tareas_del_dia import listar_tareas_del_dia
from src.elementoLimpieza.models import ElementoLimpieza
from src.exceptions import BadRequest
from src.insumoQuimico.models import (
    MovimientoStockInsumoQuimico,
    StockInsumoQuimico,
    TipoMovimientoStock,
    TipoQuimico,
)
from src.insumoQuimico.stock_services import _asegurar_stock
from src.insumoQuimico.models import InsumoQuimico
from src.unidadMedida.models import UnidadMedida
from src.checklist import exceptions
from tests.checklist.test_services import _mock_ahora, _mock_hoy, _plan_con_tarea
from tests.database import db_session  # noqa: F401

FECHA = date(2025, 6, 10)


def _guardar(db, fila):
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


@pytest.fixture
def escenario(db_session, monkeypatch):
    """Una tarea de hoy, dos productos con stock 10 y dos elementos."""
    _mock_hoy(monkeypatch, FECHA)
    _mock_ahora(monkeypatch, datetime(2025, 6, 10, 10, 0))
    _plan, equipo, tarea, autor = _plan_con_tarea(db_session, frecuencia=7, fecha_creacion=date(2025, 6, 3))
    obtener_o_crear_checklists_del_dia(db_session, equipo.id, fecha=FECHA)

    um = _guardar(db_session, UnidadMedida(nombre="Litro", simbolo="L"))
    lavandina = _guardar(db_session, InsumoQuimico(nombre="Lavandina", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=um.id))
    alcohol = _guardar(db_session, InsumoQuimico(nombre="Alcohol", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=um.id))
    for insumo in (lavandina, alcohol):
        _asegurar_stock(db_session, insumo.id).cantidad_actual = Decimal("10")
    db_session.commit()

    balde = _guardar(db_session, ElementoLimpieza(nombre="Balde"))
    trapo = _guardar(db_session, ElementoLimpieza(nombre="Trapo"))
    return {"tarea": tarea, "autor": autor, "equipo": equipo, "lavandina": lavandina, "alcohol": alcohol,
            "balde": balde, "trapo": trapo}


def _stock(db, insumo):
    db.expire_all()
    return db.get(StockInsumoQuimico, insumo.id).cantidad_actual


def _marcar(db, e, completado=True, **kwargs):
    return marcar_tarea(db, e["tarea"].id, completado, e["autor"].id, "Admin A", None, fecha=FECHA, **kwargs)


def test_completar_con_varios_productos_y_elementos_descuenta_cada_stock(db_session, escenario):
    e = escenario

    registro = _marcar(
        db_session, e,
        consumos=[(e["lavandina"].id, 2.0), (e["alcohol"].id, 0.5)],
        elementos_limpieza_ids=[e["balde"].id, e["trapo"].id],
    )

    assert sorted((c.insumo_quimico_id, c.cantidad) for c in registro.consumos) == sorted(
        [(e["lavandina"].id, 2.0), (e["alcohol"].id, 0.5)]
    )
    assert sorted(registro.elementos_limpieza_ids) == sorted([e["balde"].id, e["trapo"].id])
    assert _stock(db_session, e["lavandina"]) == Decimal("8")
    assert _stock(db_session, e["alcohol"]) == Decimal("9.5")


def test_recompletar_aplica_solo_las_diferencias_por_producto(db_session, escenario):
    e = escenario
    _marcar(db_session, e, consumos=[(e["lavandina"].id, 2.0), (e["alcohol"].id, 1.0)])

    # Lavandina sube a 3, se quita el alcohol.
    _marcar(db_session, e, consumos=[(e["lavandina"].id, 3.0)])

    assert _stock(db_session, e["lavandina"]) == Decimal("7")
    assert _stock(db_session, e["alcohol"]) == Decimal("10")
    tipos = db_session.scalars(
        select(MovimientoStockInsumoQuimico.tipo).where(
            MovimientoStockInsumoQuimico.insumo_quimico_id == e["alcohol"].id
        )
    ).all()
    assert TipoMovimientoStock.REVERSO_CONSUMO in tipos


def test_desmarcar_devuelve_todo_el_stock_y_vacia_las_listas(db_session, escenario):
    e = escenario
    _marcar(
        db_session, e,
        consumos=[(e["lavandina"].id, 2.0), (e["alcohol"].id, 0.5)],
        elementos_limpieza_ids=[e["balde"].id],
    )

    registro = _marcar(db_session, e, completado=False)

    assert registro.consumos == []
    assert registro.elementos == []
    assert _stock(db_session, e["lavandina"]) == Decimal("10")
    assert _stock(db_session, e["alcohol"]) == Decimal("10")


def test_sin_listas_conserva_lo_registrado(db_session, escenario):
    e = escenario
    _marcar(db_session, e, consumos=[(e["lavandina"].id, 2.0)], elementos_limpieza_ids=[e["trapo"].id])

    registro = _marcar(db_session, e)

    assert [(c.insumo_quimico_id, c.cantidad) for c in registro.consumos] == [(e["lavandina"].id, 2.0)]
    assert registro.elementos_limpieza_ids == [e["trapo"].id]
    assert _stock(db_session, e["lavandina"]) == Decimal("8")


def test_formato_anterior_de_un_solo_producto_sigue_funcionando(db_session, escenario):
    e = escenario

    registro = _marcar(
        db_session, e,
        insumo_quimico_id=e["alcohol"].id, cantidad_consumida=1.5, elemento_limpieza_id=e["balde"].id,
    )

    assert [(c.insumo_quimico_id, c.cantidad) for c in registro.consumos] == [(e["alcohol"].id, 1.5)]
    assert registro.elementos_limpieza_ids == [e["balde"].id]
    assert _stock(db_session, e["alcohol"]) == Decimal("8.5")


def test_producto_repetido_se_rechaza(db_session, escenario):
    e = escenario
    with pytest.raises(BadRequest):
        _marcar(db_session, e, consumos=[(e["lavandina"].id, 1.0), (e["lavandina"].id, 2.0)])


def test_cantidad_cero_se_rechaza(db_session, escenario):
    e = escenario
    with pytest.raises(exceptions.CantidadConsumidaInvalida):
        _marcar(db_session, e, consumos=[(e["lavandina"].id, 0)])


def test_listados_detalle_e_informe_muestran_todos_los_consumos(db_session, escenario):
    e = escenario
    registro = _marcar(
        db_session, e,
        consumos=[(e["lavandina"].id, 2.0), (e["alcohol"].id, 0.5)],
        elementos_limpieza_ids=[e["balde"].id, e["trapo"].id],
    )

    del_dia = listar_tareas_del_dia(db_session, FECHA, current_user=e["autor"])
    item = next(t for t in del_dia.tareas if t.registro_id == registro.id)
    assert len(item.consumos) == 2
    assert sorted(item.elementos_limpieza_ids) == sorted([e["balde"].id, e["trapo"].id])

    detalle = obtener_detalle_checklist(db_session, registro.checklist_id)
    tarea = next(t for t in detalle.tareas if t.registro_id == registro.id)
    assert sorted(c.nombre for c in tarea.consumos) == ["Alcohol", "Lavandina"]
    assert tarea.consumos[0].unidad_medida_simbolo == "L"
    assert sorted(tarea.elementos_limpieza_nombres) == ["Balde", "Trapo"]

    informe = listar_consumo_insumos(db_session, FECHA, FECHA)
    por_nombre = {i.nombre: i for i in informe.insumos}
    assert por_nombre["Lavandina"].cantidad_total == 2.0
    assert por_nombre["Alcohol"].cantidad_total == 0.5
    assert por_nombre["Lavandina"].cantidad_registros == 1


def test_migracion_mueve_el_consumo_de_una_columna_a_las_tablas_nuevas(db_session, escenario, monkeypatch):
    from src.migrations import checklist_consumos

    e = escenario
    # Una fila con el formato viejo: consumo y elemento en las columnas sueltas.
    registro = _marcar(db_session, e)
    registro.insumo_quimico_id = e["lavandina"].id
    registro.cantidad_consumida = 1.25
    registro.elemento_limpieza_id = e["balde"].id
    db_session.commit()

    # La migración usa el motor global: se la apunta al de la sesión de test.
    monkeypatch.setattr(checklist_consumos, "engine", db_session.get_bind())
    monkeypatch.setattr(checklist_consumos, "tablas", lambda: {"registro_tareas", "registro_tarea_consumos", "registro_tarea_elementos"})
    monkeypatch.setattr(checklist_consumos, "columnas_de", lambda _t: {"insumo_quimico_id", "cantidad_consumida", "elemento_limpieza_id"})
    checklist_consumos.migrar_checklist_consumos()
    checklist_consumos.migrar_checklist_consumos()  # idempotente

    db_session.expire_all()
    registro = db_session.get(RegistroTarea, registro.id)
    assert [(c.insumo_quimico_id, c.cantidad) for c in registro.consumos] == [(e["lavandina"].id, 1.25)]
    assert registro.elementos_limpieza_ids == [e["balde"].id]
    assert registro.insumo_quimico_id is None and registro.elemento_limpieza_id is None
    assert db_session.execute(text("SELECT COUNT(*) FROM registro_tarea_consumos")).scalar() == 1


def test_router_lee_las_listas_como_json():
    from fastapi import HTTPException

    from src.checklist.router import _LISTA_CONSUMOS, _LISTA_IDS, _leer_json

    consumos = _leer_json('[{"insumo_quimico_id": 3, "cantidad": 1.5}]', _LISTA_CONSUMOS, "consumos")
    assert [(c.insumo_quimico_id, c.cantidad) for c in consumos] == [(3, 1.5)]
    assert _leer_json("[2, 5]", _LISTA_IDS, "elementos_limpieza_ids") == [2, 5]
    assert _leer_json(None, _LISTA_IDS, "elementos_limpieza_ids") is None
    with pytest.raises(HTTPException) as error:
        _leer_json('[{"insumo_quimico_id": 3, "cantidad": 0}]', _LISTA_CONSUMOS, "consumos")
    assert error.value.status_code == 422
