"""Tests unitarios de validadores de schemas del módulo `Equipo`."""

import pytest

from src.Equipo import exceptions
from src.Equipo.schemas import EquipoCreate, EquipoUpdate


def test_equipo_create_valido():
    # Arrange
    datos = {"nombre": "Aspiradora", "sector_id": 1, "tipo": "Electrico"}

    # Act
    equipo = EquipoCreate(**datos)

    # Assert
    assert equipo.nombre == "Aspiradora"
    assert equipo.sector_id == 1
    assert equipo.tipo == "Electrico"


def test_equipo_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   ", "sector_id": 1, "tipo": "Electrico"}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        EquipoCreate(**datos)


def test_equipo_create_tipo_vacio_lanza_tipo_vacio():
    # Arrange
    datos = {"nombre": "Aspiradora", "sector_id": 1, "tipo": "   "}

    # Act / Assert
    with pytest.raises(exceptions.TipoVacio):
        EquipoCreate(**datos)


def test_equipo_create_sector_id_cero_lanza_sector_invalido():
    # Arrange (id_positivo rechaza <= 0)
    datos = {"nombre": "Aspiradora", "sector_id": 0, "tipo": "Electrico"}

    # Act / Assert
    with pytest.raises(exceptions.SectorInvalido):
        EquipoCreate(**datos)


def test_equipo_create_frecuencia_cero_lanza_error():
    # Arrange (ge=1)
    datos = {"nombre": "Aspiradora", "sector_id": 1, "tipo": "Electrico", "frecuencia_calibracion_dias": 0}

    # Act / Assert
    with pytest.raises(Exception):
        EquipoCreate(**datos)


def test_equipo_update_parcial_solo_tipo():
    # Arrange
    datos = {"tipo": "Mecanico"}

    # Act
    update = EquipoUpdate(**datos)

    # Assert
    assert update.tipo == "Mecanico"
    assert update.nombre is None


def test_equipo_update_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        EquipoUpdate(**datos)
