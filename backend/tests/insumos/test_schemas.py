"""Tests unitarios de validadores de schemas del módulo `insumos`."""

import pytest

from src.insumos import exceptions
from src.insumos.schemas import InsumoCreate, InsumoUpdate


def test_insumo_create_valido():
    # Arrange
    datos = {"nombre": "Harina", "unidad_medida_id": 1}

    # Act
    insumo = InsumoCreate(**datos)

    # Assert
    assert insumo.nombre == "Harina"
    assert insumo.unidad_medida_id == 1


def test_insumo_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   ", "unidad_medida_id": 1}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        InsumoCreate(**datos)


def test_insumo_create_nombre_se_recorta():
    # Arrange
    datos = {"nombre": "  Harina  ", "unidad_medida_id": 1}

    # Act
    insumo = InsumoCreate(**datos)

    # Assert
    assert insumo.nombre == "Harina"


def test_insumo_update_parcial_solo_nombre():
    # Arrange
    datos = {"nombre": "Maizena"}

    # Act
    update = InsumoUpdate(**datos)

    # Assert
    assert update.nombre == "Maizena"
    assert update.unidad_medida_id is None
    assert update.activo is None


def test_insumo_update_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        InsumoUpdate(**datos)


def test_insumo_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "activo": False}

    # Act
    update = InsumoUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.activo is False
