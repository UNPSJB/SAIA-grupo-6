"""Tests unitarios de services del módulo `insumoQuimico` (incluye stock_services)."""

from datetime import date
from decimal import Decimal

from src.insumoQuimico import exceptions, schemas
from src.insumoQuimico.models import (
    InsumoQuimico, MovimientoStockInsumoQuimico, StockInsumoQuimico,
    TipoMovimientoStock, TipoQuimico,
)
from src.insumoQuimico.services import (
    actualizar_insumo_quimico, crear_insumo_quimico, eliminar_insumo_quimico,
    listar_insumos_quimicos, listar_insumos_quimicos_paginado,
    obtener_insumo_quimico, listar_opciones_insumos,
)
from src.insumoQuimico.stock_services import (
    actualizar_stock_minimo, registrar_ajuste, registrar_ingreso,
    listar_stock_actual,
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
    fila = Personal(nombre="Juan", apellido="P", dni=dni, email=email, password="h", puede_operar=True)
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
# crear_insumo_quimico
# ---------------------------------------------------------------------------

def test_crear_insumo_quimico_caso_feliz(db_session):
    # Arrange
    um = _um(db_session)
    datos = schemas.InsumoQuimicoCreate(nombre="Detergente", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=um.id)

    # Act
    creado = crear_insumo_quimico(db_session, datos)

    # Assert
    assert creado.id is not None
    assert creado.nombre == "Detergente"
    assert creado.activo is True


def test_crear_insumo_quimico_nombre_duplicado_activo_lanza_ya_existe(db_session):
    # Arrange
    um = _um(db_session)
    _iq(db_session, nombre="Detergente", um_id=um.id)
    datos = schemas.InsumoQuimicoCreate(nombre="Detergente", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=um.id)

    # Act / Assert
    try:
        crear_insumo_quimico(db_session, datos)
    except exceptions.InsumoQuimicoYaExiste:
        pass
    else:
        raise AssertionError("Se esperaba InsumoQuimicoYaExiste")


def test_crear_insumo_quimico_unidad_inactiva_lanza_error(db_session):
    # Arrange
    um = _um(db_session, activo=False)
    datos = schemas.InsumoQuimicoCreate(nombre="Detergente", tipo=TipoQuimico.DETERGENTE, unidad_medida_id=um.id)

    # Act / Assert
    try:
        crear_insumo_quimico(db_session, datos)
    except exceptions.UnidadMedidaInactiva:
        pass
    else:
        raise AssertionError("Se esperaba UnidadMedidaInactiva")


# ---------------------------------------------------------------------------
# listar_insumos_quimicos
# ---------------------------------------------------------------------------

def test_listar_insumos_quimicos_vacio(db_session):
    # Arrange

    # Act
    resultado = listar_insumos_quimicos(db_session)

    # Assert
    assert resultado == []


def test_listar_insumos_quimicos_solo_activos(db_session):
    # Arrange
    um = _um(db_session)
    _iq(db_session, nombre="Activo", um_id=um.id)
    _iq(db_session, nombre="Inactivo", um_id=um.id, activo=False)

    # Act
    resultado = listar_insumos_quimicos(db_session)

    # Assert
    assert len(resultado) == 1


def test_listar_insumos_quimicos_filtro_por_tipo(db_session):
    # Arrange
    um = _um(db_session)
    _iq(db_session, nombre="A", tipo=TipoQuimico.DETERGENTE, um_id=um.id)
    _iq(db_session, nombre="B", tipo=TipoQuimico.DESINFECTANTE, um_id=um.id)

    # Act
    resultado = listar_insumos_quimicos(db_session, tipo=TipoQuimico.DETERGENTE)

    # Assert
    assert len(resultado) == 1


# ---------------------------------------------------------------------------
# listar_insumos_quimicos_paginado
# ---------------------------------------------------------------------------

def test_listar_insumos_quimicos_paginado_page_y_page_size(db_session):
    # Arrange
    um = _um(db_session)
    for i in range(5):
        _iq(db_session, nombre=f"IQ {i}", um_id=um.id)

    # Act
    items, total = listar_insumos_quimicos_paginado(db_session, incluir_inactivos=False, page=1, page_size=2)

    # Assert
    assert total == 5
    assert len(items) == 2


# ---------------------------------------------------------------------------
# obtener_insumo_quimico
# ---------------------------------------------------------------------------

def test_obtener_insumo_quimico_existe(db_session):
    # Arrange
    um = _um(db_session)
    creado = _iq(db_session, um_id=um.id)

    # Act
    obtenido = obtener_insumo_quimico(db_session, creado.id)

    # Assert
    assert obtenido.id == creado.id


def test_obtener_insumo_quimico_no_existe(db_session):
    # Arrange

    # Act / Assert
    try:
        obtener_insumo_quimico(db_session, 9999)
    except exceptions.InsumoQuimicoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba InsumoQuimicoNoEncontrado")


# ---------------------------------------------------------------------------
# actualizar_insumo_quimico
# ---------------------------------------------------------------------------

def test_actualizar_insumo_quimico_parcial(db_session):
    # Arrange
    um = _um(db_session)
    creado = _iq(db_session, nombre="Detergente", um_id=um.id)
    datos = schemas.InsumoQuimicoUpdate(nombre="Jabon")

    # Act
    actualizado = actualizar_insumo_quimico(db_session, creado.id, datos)

    # Assert
    assert actualizado.nombre == "Jabon"


def test_actualizar_insumo_quimico_no_existe(db_session):
    # Arrange
    datos = schemas.InsumoQuimicoUpdate(nombre="Otro")

    # Act / Assert
    try:
        actualizar_insumo_quimico(db_session, 9999, datos)
    except exceptions.InsumoQuimicoNoEncontrado:
        pass
    else:
        raise AssertionError("Se esperaba InsumoQuimicoNoEncontrado")


# ---------------------------------------------------------------------------
# eliminar_insumo_quimico (baja lógica)
# ---------------------------------------------------------------------------

def test_eliminar_insumo_quimico_pasa_a_activo_falso(db_session):
    # Arrange
    um = _um(db_session)
    creado = _iq(db_session, um_id=um.id)

    # Act
    eliminado = eliminar_insumo_quimico(db_session, creado.id)

    # Assert
    assert eliminado.activo is False


# ---------------------------------------------------------------------------
# listar_opciones_insumos
# ---------------------------------------------------------------------------

def test_listar_opciones_insumos_solo_activos(db_session):
    # Arrange
    um = _um(db_session)
    _iq(db_session, nombre="Activo", um_id=um.id)
    _iq(db_session, nombre="Inactivo", um_id=um.id, activo=False)

    # Act
    opciones = listar_opciones_insumos(db_session)

    # Assert
    assert len(opciones) == 1


# ---------------------------------------------------------------------------
# stock_services: registrar_ingreso / registrar_ajuste / stock insuficiente
# ---------------------------------------------------------------------------

def test_registrar_ingreso_aumenta_stock(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)
    proveedor = _proveedor(db_session)
    datos = schemas.IngresoStockCreate(proveedor_id=proveedor.id, numero_lote="LOTE-1", cantidad=Decimal("10"))

    # Act
    resultado = registrar_ingreso(db_session, iq.id, datos, usuario)

    # Assert
    assert resultado.cantidad_actual == Decimal("10")


def test_registrar_ingreso_stock_insuficiente_no_aplica(db_session):
    # Arrange (ajuste negativo que deja stock negativo)
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    usuario = _personal(db_session)

    # Primero ingreso
    datos_ingreso = schemas.IngresoStockCreate(
        proveedor_id=_proveedor(db_session).id, numero_lote="LOTE-1", cantidad=Decimal("5")
    )
    registrar_ingreso(db_session, iq.id, datos_ingreso, usuario)

    # Ajuste negativo de 10 (solo hay 5)
    datos_ajuste = schemas.AjusteStockCreate(operacion="decremento", cantidad=Decimal("10"), motivo="prueba")

    # Act / Assert
    try:
        registrar_ajuste(db_session, iq.id, datos_ajuste, usuario)
    except exceptions.StockInsuficiente:
        pass
    else:
        raise AssertionError("Se esperaba StockInsuficiente")


def test_actualizar_stock_minimo(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    datos = schemas.StockMinimoUpdate(stock_minimo=Decimal("5"))

    # Act
    resultado = actualizar_stock_minimo(db_session, iq.id, datos)

    # Assert
    assert resultado.stock_minimo == Decimal("5")


def test_listar_stock_actual_incluye_stock_bajo(db_session):
    # Arrange
    um = _um(db_session)
    iq = _iq(db_session, um_id=um.id)
    # Crear stock con minimo y cantidad menor
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
