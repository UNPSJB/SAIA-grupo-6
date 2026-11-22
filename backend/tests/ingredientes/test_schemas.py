"""Tests unitarios de validadores de schemas del módulo `ingredientes`."""

import pytest

from src.ingredientes import exceptions
from src.ingredientes.schemas import IngredienteCreate, IngredienteUpdate


def test_ingrediente_create_valido():
    # Arrange
    datos = {"nombre": "Harina", "unidad_medida_id": 1}

    # Act
    ingrediente = IngredienteCreate(**datos)

    # Assert
    assert ingrediente.nombre == "Harina"
    assert ingrediente.unidad_medida_id == 1


def test_ingrediente_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   ", "unidad_medida_id": 1}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        IngredienteCreate(**datos)


def test_ingrediente_create_nombre_se_recorta():
    # Arrange
    datos = {"nombre": "  Harina  ", "unidad_medida_id": 1}

    # Act
    ingrediente = IngredienteCreate(**datos)

    # Assert
    assert ingrediente.nombre == "Harina"


def test_ingrediente_update_parcial_solo_nombre():
    # Arrange
    datos = {"nombre": "Maizena"}

    # Act
    update = IngredienteUpdate(**datos)

    # Assert
    assert update.nombre == "Maizena"
    assert update.unidad_medida_id is None
    assert update.activo is None


def test_ingrediente_update_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        IngredienteUpdate(**datos)


def test_ingrediente_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "activo": False}

    # Act
    update = IngredienteUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.activo is False
