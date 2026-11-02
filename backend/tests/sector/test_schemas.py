"""Tests unitarios de validadores de schemas del módulo `sector`."""

import pytest

from src.sector import exceptions
from src.sector.schemas import SectorCreate, SectorUpdate


# ---------------------------------------------------------------------------
# SectorCreate
# ---------------------------------------------------------------------------

def test_sector_create_valido():
    # Arrange
    datos = {"nombre": "Limpieza", "descripcion": "Area de limpieza"}

    # Act
    sector = SectorCreate(**datos)

    # Assert
    assert sector.nombre == "Limpieza"
    assert sector.descripcion == "Area de limpieza"


def test_sector_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        SectorCreate(**datos)


def test_sector_create_nombre_con_caracteres_invalidos_lanza_nombre_invalido():
    # Arrange
    datos = {"nombre": "Limpieza@!"}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        SectorCreate(**datos)


def test_sector_create_sin_descripcion_es_opcional():
    # Arrange
    datos = {"nombre": "Limpieza"}

    # Act
    sector = SectorCreate(**datos)

    # Assert
    assert sector.descripcion is None


# ---------------------------------------------------------------------------
# SectorUpdate
# ---------------------------------------------------------------------------

def test_sector_update_parcial_solo_nombre():
    # Arrange
    datos = {"nombre": "Cocina"}

    # Act
    update = SectorUpdate(**datos)

    # Assert
    assert update.nombre == "Cocina"
    assert update.descripcion is None
    assert update.activo is None


def test_sector_update_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        SectorUpdate(**datos)


def test_sector_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "descripcion": "Nueva"}

    # Act
    update = SectorUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.descripcion == "Nueva"


def test_sector_update_activo_puede_ser_bool():
    # Arrange
    datos = {"activo": False}

    # Act
    update = SectorUpdate(**datos)

    # Assert
    assert update.activo is False


# ---------------------------------------------------------------------------
# Parametrizado: nombres validos e invalidos
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "nombre",
    ["Limpieza", "Area 1", "Cocina - Principal", "Depósito (A)"],
)
def test_sector_create_nombres_validos(nombre):
    # Arrange
    datos = {"nombre": nombre}

    # Act
    sector = SectorCreate(**datos)

    # Assert
    assert sector.nombre == nombre


@pytest.mark.parametrize(
    "nombre",
    ["", "   ", "Limpieza@", "Cocina#"],
)
def test_sector_create_nombres_invalidos(nombre):
    # Arrange
    datos = {"nombre": nombre}

    # Act / Assert
    with pytest.raises((exceptions.NombreVacio, exceptions.NombreInvalido)):
        SectorCreate(**datos)
