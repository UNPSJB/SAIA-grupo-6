"""Tests unitarios de validadores de schemas del módulo `incidente`."""

import pytest

from src.incidente import exceptions
from src.incidente.schemas import IncidenteCreate
from src.incidente.constants import TipoIncidente, EstadoIncidente


def test_incidente_create_valido():
    # Arrange
    datos = {
        "titulo": "Fuga de agua",
        "descripcion": "Hay una fuga en el baño",
        "tipo": TipoIncidente.PLAGAS,
    }

    # Act
    inc = IncidenteCreate(**datos)

    # Assert
    assert inc.titulo == "Fuga de agua"
    assert inc.tipo == TipoIncidente.PLAGAS


def test_incidente_create_titulo_vacio():
    # Arrange
    datos = {"titulo": "   ", "descripcion": "Hay una fuga", "tipo": TipoIncidente.PLAGAS}

    # Act / Assert
    with pytest.raises(exceptions.TituloVacio):
        IncidenteCreate(**datos)


def test_incidente_create_titulo_demasiado_largo():
    # Arrange (String(60))
    datos = {"titulo": "A" * 61, "descripcion": "Hay una fuga", "tipo": TipoIncidente.PLAGAS}

    # Act / Assert
    with pytest.raises(exceptions.TituloDemasiadoLargo):
        IncidenteCreate(**datos)


def test_incidente_create_descripcion_vacia():
    # Arrange
    datos = {"titulo": "Fuga", "descripcion": "   ", "tipo": TipoIncidente.PLAGAS}

    # Act / Assert
    with pytest.raises(exceptions.DescripcionVacia):
        IncidenteCreate(**datos)


def test_incidente_create_titulo_en_limite_60():
    # Arrange
    datos = {"titulo": "A" * 60, "descripcion": "Hay una fuga", "tipo": TipoIncidente.PLAGAS}

    # Act
    inc = IncidenteCreate(**datos)

    # Assert
    assert len(inc.titulo) == 60
