"""Tests unitarios de validadores de schemas del módulo `elementoLimpieza`."""

import pytest
from datetime import date

from src.elementoLimpieza import exceptions
from src.elementoLimpieza.schemas import ElementoLimpiezaCreate, ElementoLimpiezaUpdate


def test_elemento_limpieza_create_valido():
    # Arrange
    datos = {"nombre": "Detergente", "frecuencia_recambio_dias": 30}

    # Act
    elemento = ElementoLimpiezaCreate(**datos)

    # Assert
    assert elemento.nombre == "Detergente"
    assert elemento.frecuencia_recambio_dias == 30


def test_elemento_limpieza_create_frecuencia_default_30():
    # Arrange
    datos = {"nombre": "Detergente"}

    # Act
    elemento = ElementoLimpiezaCreate(**datos)

    # Assert
    assert elemento.frecuencia_recambio_dias == 30


def test_elemento_limpieza_create_frecuencia_0_lanza_error():
    # Arrange (ge=1)
    datos = {"nombre": "Detergente", "frecuencia_recambio_dias": 0}

    # Act / Assert
    with pytest.raises(Exception):
        ElementoLimpiezaCreate(**datos)


def test_elemento_limpieza_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        ElementoLimpiezaCreate(**datos)


def test_elemento_limpieza_create_nombre_con_caracteres_invalidos_lanza_nombre_invalido():
    # Arrange
    datos = {"nombre": "Deterg@"}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        ElementoLimpiezaCreate(**datos)


def test_elemento_limpieza_update_parcial_solo_frecuencia():
    # Arrange
    datos = {"frecuencia_recambio_dias": 60}

    # Act
    update = ElementoLimpiezaUpdate(**datos)

    # Assert
    assert update.frecuencia_recambio_dias == 60
    assert update.nombre is None


def test_elemento_limpieza_update_frecuencia_0_lanza_error():
    # Arrange (ge=1)
    datos = {"frecuencia_recambio_dias": 0}

    # Act / Assert
    with pytest.raises(Exception):
        ElementoLimpiezaUpdate(**datos)
