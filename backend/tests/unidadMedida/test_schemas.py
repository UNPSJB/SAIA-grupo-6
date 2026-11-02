"""Tests unitarios de validadores de schemas del módulo `unidadMedida`."""

import pytest

from src.unidadMedida import exceptions
from src.unidadMedida.schemas import UnidadMedidaCreate, UnidadMedidaUpdate


def test_unidad_medida_create_valido():
    # Arrange
    datos = {"nombre": "Kilogramo", "simbolo": "kg"}

    # Act
    um = UnidadMedidaCreate(**datos)

    # Assert
    assert um.nombre == "Kilogramo"
    assert um.simbolo == "KG"


def test_unidad_medida_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   ", "simbolo": "KG"}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        UnidadMedidaCreate(**datos)


def test_unidad_medida_create_nombre_solo_digitos_lanza_nombre_invalido():
    # Arrange (exigir_alfabetico=True rechaza solo digitos)
    datos = {"nombre": "123", "simbolo": "KG"}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        UnidadMedidaCreate(**datos)


def test_unidad_medida_create_simbolo_vacio_lanza_simbolo_vacio():
    # Arrange
    datos = {"nombre": "Kilogramo", "simbolo": "   "}

    # Act / Assert
    with pytest.raises(exceptions.SimboloVacio):
        UnidadMedidaCreate(**datos)


def test_unidad_medida_create_simbolo_se_pasa_a_mayusculas():
    # Arrange
    datos = {"nombre": "Kilogramo", "simbolo": "kg"}

    # Act
    um = UnidadMedidaCreate(**datos)

    # Assert
    assert um.simbolo == "KG"


def test_unidad_medida_update_parcial_solo_simbolo():
    # Arrange
    datos = {"simbolo": "L"}

    # Act
    update = UnidadMedidaUpdate(**datos)

    # Assert
    assert update.simbolo == "L"
    assert update.nombre is None


def test_unidad_medida_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "simbolo": "KG"}

    # Act
    update = UnidadMedidaUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.simbolo == "KG"


@pytest.mark.parametrize(
    "nombre,simbolo",
    [
        ("Kilogramo", "kg"),
        ("Metro", "m"),
        ("Unidad 1", "U1"),
    ],
)
def test_unidad_medida_create_validos_parametrizado(nombre, simbolo):
    # Arrange
    datos = {"nombre": nombre, "simbolo": simbolo}

    # Act
    um = UnidadMedidaCreate(**datos)

    # Assert
    assert um.nombre == nombre
    assert um.simbolo == simbolo.upper()
