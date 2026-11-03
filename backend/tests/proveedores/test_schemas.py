"""Tests unitarios de validadores de schemas del módulo `proveedores`."""

import pytest

from src.proveedores import exceptions
from src.proveedores.schemas import ProveedorCreate, ProveedorUpdate


def test_proveedor_create_valido():
    # Arrange
    datos = {"nombre": "Proveedor A", "matricula": "MAT-001"}

    # Act
    proveedor = ProveedorCreate(**datos)

    # Assert
    assert proveedor.nombre == "Proveedor A"
    assert proveedor.matricula == "MAT-001"


def test_proveedor_create_nombre_vacio_lanza_nombre_vacio():
    # Arrange
    datos = {"nombre": "   ", "matricula": "MAT-001"}

    # Act / Assert
    with pytest.raises(exceptions.NombreVacio):
        ProveedorCreate(**datos)


def test_proveedor_create_matricula_vacia_lanza_matricula_vacia():
    # Arrange
    datos = {"nombre": "Proveedor A", "matricula": "   "}

    # Act / Assert
    with pytest.raises(exceptions.MatriculaVacia):
        ProveedorCreate(**datos)


def test_proveedor_update_parcial_solo_matricula():
    # Arrange
    datos = {"matricula": "MAT-002"}

    # Act
    update = ProveedorUpdate(**datos)

    # Assert
    assert update.matricula == "MAT-002"
    assert update.nombre is None


def test_proveedor_update_nombre_none_se_tolerar():
    # Arrange
    datos = {"nombre": None, "matricula": "MAT-001"}

    # Act
    update = ProveedorUpdate(**datos)

    # Assert
    assert update.nombre is None
    assert update.matricula == "MAT-001"
