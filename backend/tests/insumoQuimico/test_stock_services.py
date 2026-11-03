"""Tests unitarios de `stock_services` del módulo `insumoQuimico`."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from src.insumoQuimico import exceptions
from src.insumoQuimico.models import (
    InsumoQuimico,
    MovimientoStockInsumoQuimico,
    StockInsumoQuimico,
    TipoMovimientoStock,
    TipoQuimico,
)
from src.insumoQuimico.stock_services import (
    actualizar_stock_minimo,
    listar_lotes,
    listar_movimientos,
    listar_stock_actual,
    listar_stock_actual_paginado,
    registrar_ajuste,
    registrar_ingreso,
    sincronizar_consumo_checklist,
)
from src.personal.models import Personal
from src.proveedores.models import Proveedor
from src.unidadMedida.models import UnidadMedida
from tests.database import db_session


def _um(db, nombre="Unidad", simbolo="UN", activo=True):
    fila = UnidadMedida(nombre=nombre, simbolo=simbolo, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _iq(db, nombre="Detergente", tipo=TipoQuimico.DETERGENTE, um_id=1, activo=True):
    fila = InsumoQuimico(nombre=nombre, tipo=tipo, unidad_medida_id=um_id, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _personal(db, dni="12345678", email="j@test.com"):
    fila = Personal(
        nombre="Juan", apellido="Perez", dni=dni, email=email,
        password="h", puede_operar=True,
    )
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


def _proveedor(db, matricula="MAT-1", nombre="Prov", activo=True):
    fila = Proveedor(nombre=nombre, matricula=matricula, activo=activo)
    db.info["sin_auditoria"] = True
    try:
        db.add(fila)
        db.commit()
        db.refresh(fila)
    finally:
        db.info.pop("sin_auditoria", None)
    return fila


# ---------------------------------------------------------------------------
# registrar_ingreso
# ---------------------------------------------------------------------------

def test_registrar_ingreso_aumenta_stock(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)
    proveedor = _proveedor(db_session)
    from src.insumoQuimico.schemas import IngresoStockCreate
    datos = IngresoStockCreate(
        proveedor_id=proveedor.id, numero_lote="LOTE-1", cantidad=Decimal("10"),
    )

    # Act
    resultado = registrar_ingreso(db_session, iq.id, datos, usuario)

    # Assert
    assert resultado.cantidad_actual == Decimal("10")


def test_registrar_ingreso_stock_insuficiente_no_aplica(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)
    proveedor = _proveedor(db_session)
    from src.insumoQuimico.schemas import IngresoStockCreate, AjusteStockCreate

    # Primero ingreso de 5
    datos_ingreso = IngresoStockCreate(
        proveedor_id=proveedor.id, numero_lote="LOTE-1", cantidad=Decimal("5"),
    )
    registrar_ingreso(db_session, iq.id, datos_ingreso, usuario)

    # Ajuste negativo de 10 (solo hay 5)
    datos_ajuste = AjusteStockCreate(
        operacion="decremento", cantidad=Decimal("10"), motivo="prueba",
    )

    # Act / Assert
    try:
        registrar_ajuste(db_session, iq.id, datos_ajuste, usuario)
    except exceptions.StockInsuficiente:
        pass
    else:
        raise AssertionError("Se esperaba StockInsuficiente")


# ---------------------------------------------------------------------------
# actualizar_stock_minimo
# ---------------------------------------------------------------------------

def test_actualizar_stock_minimo(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.schemas import StockMinimoUpdate
    datos = StockMinimoUpdate(stock_minimo=Decimal("5"))

    # Act
    resultado = actualizar_stock_minimo(db_session, iq.id, datos)

    # Assert
    assert resultado.stock_minimo == Decimal("5")


def test_actualizar_stock_minimo_insumo_inexistente(db_session):
    # Arrange
    from src.insumoQuimico.schemas import StockMinimoUpdate
    datos = StockMinimoUpdate(stock_minimo=Decimal("5"))

    # Act / Assert
    try:
        actualizar_stock_minimo(db_session, 9999, datos)
    except exceptions.InsumoQuimicoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba InsumoQuimicoNoEncontrado")


# ---------------------------------------------------------------------------
# listar_stock_actual
# ---------------------------------------------------------------------------

def test_listar_stock_actual_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_stock_actual(db_session)

    # Assert
    assert resultado == []


def test_listar_stock_actual_con_stock(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("10")
    stock.stock_minimo = Decimal("5")
    db_session.commit()

    # Act
    resultado = listar_stock_actual(db_session)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].cantidad_actual == Decimal("10")
    assert resultado[0].stock_minimo == Decimal("5")
    assert resultado[0].stock_bajo is False


def test_listar_stock_actual_stock_bajo_true(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("2")
    stock.stock_minimo = Decimal("5")
    db_session.commit()

    # Act
    resultado = listar_stock_actual(db_session, stock_bajo=True)

    # Assert
    assert len(resultado) == 1
    assert resultado[0].stock_bajo is True


def test_listar_stock_actual_stock_bajo_false(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("10")
    stock.stock_minimo = Decimal("5")
    db_session.commit()

    # Act
    resultado = listar_stock_actual(db_session, stock_bajo=False)

    # Assert
    assert len(resultado) == 1


def test_listar_stock_actual_buscar_ignora_tildes(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, nombre="Jab\u00f3n Liquido", um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("10")
    db_session.commit()

    # Act
    resultado = listar_stock_actual(db_session, buscar="jabon")

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_stock_actual_paginado
# ---------------------------------------------------------------------------

def test_listar_stock_actual_paginado_page_y_page_size(db_session):
    # Arrange
    um = _um(db_session)
    for i in range(5):
        iq = _iq(db_session, nombre=f"IQ {i}", um_id=um.id)
        from src.insumoQuimico.stock_services import _asegurar_stock
        stock = _asegurar_stock(db_session, iq.id)
        stock.cantidad_actual = Decimal(i * 10)
        db_session.commit()

    # Act
    items, total = listar_stock_actual_paginado(
        db_session, buscar=None, stock_bajo=None, orden="nombre_asc",
        page=1, page_size=2,
    )

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# listar_movimientos
# ---------------------------------------------------------------------------

def test_listar_movimientos_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_movimientos(
        db_session, insumo_quimico_id=None, fecha_desde=None,
        fecha_hasta=None, tipo=None, limit=10, offset=0,
    )

    # Assert
    assert resultado.items == []
    assert resultado.total == 0


def test_listar_movimientos_con_datos(db_session, monkeypatch):
    # Arrange
    from datetime import datetime
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)
    from src.insumoQuimico.schemas import IngresoStockCreate
    datos = IngresoStockCreate(
        proveedor_id=_proveedor(db_session).id, numero_lote="LOTE-1",
        cantidad=Decimal("10"),
    )
    registrar_ingreso(db_session, iq.id, datos, usuario)

    # Act
    resultado = listar_movimientos(
        db_session, insumo_quimico_id=iq.id, fecha_desde=None,
        fecha_hasta=None, tipo=None, limit=10, offset=0,
    )

    # Assert
    assert resultado.total == 1
    assert len(resultado.items) == 1
    assert resultado.items[0].tipo == TipoMovimientoStock.INGRESO


# ---------------------------------------------------------------------------
# listar_lotes
# ---------------------------------------------------------------------------

def test_listar_lotes_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_lotes(
        db_session, proveedor_id=None, insumo_quimico_id=None,
        numero_lote=None, limit=10, offset=0,
    )

    # Assert
    assert resultado.items == []
    assert resultado.total == 0


def test_listar_lotes_con_datos(db_session, monkeypatch):
    # Arrange
    from datetime import datetime
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)
    proveedor = _proveedor(db_session)
    from src.insumoQuimico.schemas import IngresoStockCreate
    datos = IngresoStockCreate(
        proveedor_id=proveedor.id, numero_lote="LOTE-001", cantidad=Decimal("10"),
    )
    registrar_ingreso(db_session, iq.id, datos, usuario)

    # Act
    resultado = listar_lotes(
        db_session, proveedor_id=None, insumo_quimico_id=iq.id,
        numero_lote=None, limit=10, offset=0,
    )

    # Assert
    assert resultado.total == 1
    assert len(resultado.items) == 1
    assert resultado.items[0].numero_lote == "LOTE-001"


# ---------------------------------------------------------------------------
# sincronizar_consumo_checklist
# ---------------------------------------------------------------------------

def test_sincronizar_consumo_checklist_sin_cambios(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("10")
    db_session.commit()

    # Act (mismo consumo anterior y nuevo, no debe cambiar nada)
    sincronizar_consumo_checklist(
        db_session, registro_id=1, checklist_id=1,
        checklist_fecha=date(2025, 6, 10), tarea_nombre="Tarea",
        consumo_anterior=(iq.id, Decimal("5")),
        consumo_nuevo=(iq.id, Decimal("5")),
        usuario_id=1, usuario_nombre="Usuario",
    )

    # Assert - stock no debe cambiar
    stock_actualizado = db_session.get(StockInsumoQuimico, iq.id)
    assert stock_actualizado.cantidad_actual == Decimal("10")


def test_sincronizar_consumo_checklist_con_cambio(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    from src.insumoQuimico.stock_services import _asegurar_stock
    stock = _asegurar_stock(db_session, iq.id)
    stock.cantidad_actual = Decimal("10")
    db_session.commit()

    # Act (consumo aumenta de 5 a 8, resta 3)
    sincronizar_consumo_checklist(
        db_session, registro_id=1, checklist_id=1,
        checklist_fecha=date(2025, 6, 10), tarea_nombre="Tarea",
        consumo_anterior=(iq.id, Decimal("5")),
        consumo_nuevo=(iq.id, Decimal("8")),
        usuario_id=1, usuario_nombre="Usuario",
    )

    # Assert - stock debe bajar de 10 a 7
    stock_actualizado = db_session.get(StockInsumoQuimico, iq.id)
    assert stock_actualizado.cantidad_actual == Decimal("7")



