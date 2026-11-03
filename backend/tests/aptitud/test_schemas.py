"""Tests unitarios de validadores de schemas del módulo `aptitud`."""

import pytest

from src.aptitud import exceptions
from src.aptitud.schemas import AptitudCreate, AptitudUpdate


def test_aptitud_create_valido():
    # Arrange
    datos = {"nombre": "Altura", "descripcion": "Trabajo en altura"}

    # Act
    aptitud = AptitudCreate(**datos)

    # Assert
    assert aptitud.nombre == "Altura"
    assert aptitud.descripcion == "Trabajo en altura"


def test_aptitud_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        AptitudCreate(**datos)


def test_aptitud_create_nombre_con_caracteres_invalidos_lanza_nombre_invalido():
    # Arrange
    datos = {"nombre": "Altura@"}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        AptitudCreate(**datos)


def test_aptitud_update_parcial_solo_descripcion():
    # Arrange
    datos = {"descripcion": "Nueva descripcion"}

    # Act
    update = AptitudUpdate(**datos)

    # Assert
    assert update.descripcion == "Nueva descripcion"
    assert update.nombre is None


def test_aptitud_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "descripcion": "Nueva"}

    # Act
    update = AptitudUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.descripcion == "Nueva"


@pytest.mark.parametrize(
    "nombre",
    ["Altura", "Trabajo en altura", "Capacitaci\u00f3n - Nivel 1"],
)
def test_aptitud_create_nombres_validos(nombre):
    # Arrange
    datos = {"nombre": nombre}

    # Act
    aptitud = AptitudCreate(**datos)

    # Assert
    assert aptitud.nombre == nombre


@pytest.mark.parametrize(
    "nombre",
    ["", "   ", "Altura@"],
)
def test_aptitud_create_nombres_invalidos(nombre):
    # Arrange
    datos = {"nombre": nombre}

    # Act / Assert
    with pytest.raises((exceptions.NombreVacio, exceptions.NombreInvalido)):
        AptitudCreate(**datos)
