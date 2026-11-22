"""Tests unitarios de validadores de schemas del módulo `proveedores`."""

import pytest
from pydantic import ValidationError

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
    with pytest.raises(ValidationError, match="El nombre del proveedor no puede estar vacío"):
        ProveedorCreate(**datos)


def test_proveedor_create_sin_cuit_ni_matricula_pide_el_cuit():
    # Arrange: una matrícula en blanco cuenta como que no vino.
    datos = {"nombre": "Proveedor A", "matricula": "   "}

    # Act / Assert
    with pytest.raises(ValidationError, match="Ingresá el CUIT del proveedor"):
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
