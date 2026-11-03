"""Tests unitarios de validadores de schemas del módulo `insumoQuimico`."""

import pytest
from datetime import date
from decimal import Decimal

from src.insumoQuimico import exceptions
from src.insumoQuimico.models import TipoQuimico, TipoMovimientoStock
from src.insumoQuimico.schemas import (
    InsumoQuimicoCreate,
    InsumoQuimicoUpdate,
    StockMinimoUpdate,
    IngresoStockCreate,
    AjusteStockCreate,
)


def test_insumo_quimico_create_valido():
    # Arrange
    datos = {
        "nombre": "Detergente",
        "tipo": TipoQuimico.DETERGENTE,
        "unidad_medida_id": 1,
    }

    # Act
    insumo = InsumoQuimicoCreate(**datos)

    # Assert
    assert insumo.nombre == "Detergente"
    assert insumo.tipo == TipoQuimico.DETERGENTE
    assert insumo.unidad_medida_id == 1


def test_insumo_quimico_create_nombre_vacio():
    # Arrange
    datos = {
        "nombre": "   ",
        "tipo": TipoQuimico.DETERGENTE,
        "unidad_medida_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        InsumoQuimicoCreate(**datos)


def test_insumo_quimico_create_nombre_caracteres_invalidos():
    # Arrange
    datos = {
        "nombre": "Deterg@nte",
        "tipo": TipoQuimico.DETERGENTE,
        "unidad_medida_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        InsumoQuimicoCreate(**datos)


def test_insumo_quimico_create_nombre_sin_letras():
    # Arrange (debe tener al menos una letra)
    datos = {
        "nombre": "   ---   ",
        "tipo": TipoQuimico.DETERGENTE,
        "unidad_medida_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        InsumoQuimicoCreate(**datos)


def test_insumo_quimico_update_parcial():
    # Arrange
    datos = {"nombre": "Jabon"}

    # Act
    update = InsumoQuimicoUpdate(**datos)

    # Assert
    assert update.nombre == "Jabon"
    assert update.tipo is None


def test_stock_minimo_update_valido():
    # Arrange
    datos = {"stock_minimo": Decimal("5")}

    # Act
    update = StockMinimoUpdate(**datos)

    # Assert
    assert update.stock_minimo == Decimal("5")


def test_stock_minimo_update_negativo():
    # Arrange (ge=0)
    datos = {"stock_minimo": Decimal("-1")}

    # Act / Assert
    with pytest.raises(Exception):
        StockMinimoUpdate(**datos)


def test_ingreso_stock_create_valido():
    # Arrange
    datos = {
        "cantidad": Decimal("10"),
        "proveedor_id": 1,
        "numero_lote": "LOTE-001",
    }

    # Act
    ingreso = IngresoStockCreate(**datos)

    # Assert
    assert ingreso.cantidad == Decimal("10")
    assert ingreso.numero_lote == "LOTE-001"


def test_ingreso_stock_cantidad_cero():
    # Arrange (gt=0)
    datos = {
        "cantidad": Decimal("0"),
        "proveedor_id": 1,
        "numero_lote": "LOTE-001",
    }

    # Act / Assert
    with pytest.raises(Exception):
        IngresoStockCreate(**datos)


def test_ingreso_stock_numero_lote_vacio():
    # Arrange
    datos = {
        "cantidad": Decimal("10"),
        "proveedor_id": 1,
        "numero_lote": "   ",
    }

    # Act / Assert
    with pytest.raises(exceptions.NumeroLoteRequerido):
        IngresoStockCreate(**datos)


def test_ajuste_stock_create_valido_incremento():
    # Arrange
    datos = {
        "cantidad": Decimal("5"),
        "operacion": "incremento",
        "motivo": "Ajuste de inventario",
    }

    # Act
    ajuste = AjusteStockCreate(**datos)

    # Assert
    assert ajuste.operacion == "incremento"
    assert ajuste.motivo == "Ajuste de inventario"


def test_ajuste_stock_create_operacion_invalida():
    # Arrange (Literal)
    datos = {
        "cantidad": Decimal("5"),
        "operacion": "invalido",
        "motivo": "Ajuste",
    }

    # Act / Assert
    with pytest.raises(Exception):
        AjusteStockCreate(**datos)


def test_ajuste_stock_create_motivo_vacio():
    # Arrange
    datos = {
        "cantidad": Decimal("5"),
        "operacion": "incremento",
        "motivo": "   ",
    }

    # Act / Assert
    with pytest.raises(exceptions.MotivoAjusteRequerido):
        AjusteStockCreate(**datos)


@pytest.mark.parametrize(
    "operacion",
    ["incremento", "decremento"],
)
def test_ajuste_stock_create_operaciones_validas(operacion):
    # Arrange
    datos = {
        "cantidad": Decimal("5"),
        "operacion": operacion,
        "motivo": "Ajuste",
    }

    # Act
    ajuste = AjusteStockCreate(**datos)

    # Assert
    assert ajuste.operacion == operacion
