"""Tests unitarios de validadores de schemas del módulo `vencimientos`."""

from datetime import date

from src.vencimientos.schemas import (
    VencimientoConsolidadoResponse,
    OpcionPersona,
    VencimientosOpcionesResponse,
)


def test_vencimiento_consolidado_response_valido():
    # Arrange
    datos = {
        "id_vencimiento": "personal-1",
        "tipo": "PERSONAL",
        "entidad_id": 1,
        "sujeto_id": 1,
        "detalle": "Altura",
        "sujeto": "Juan Perez",
        "fecha_vencimiento": date(2025, 12, 31),
        "dias_restantes": 10,
        "estado": "PROXIMO",
        "link_destino": "/personal/detalle/1",
    }

    # Act
    vencimiento = VencimientoConsolidadoResponse(**datos)

    # Assert
    assert vencimiento.tipo == "PERSONAL"
    assert vencimiento.dias_restantes == 10


def test_opcion_persona_valido():
    # Arrange
    datos = {"id": 1, "nombre": "Juan Perez"}

    # Act
    opcion = OpcionPersona(**datos)

    # Assert
    assert opcion.nombre == "Juan Perez"


def test_vencimientos_opciones_response_valido():
    # Arrange
    datos = {
        "personas": [{"id": 1, "nombre": "Juan Perez"}],
        "aptitudes": ["Altura", "Electricidad"],
    }

    # Act
    response = VencimientosOpcionesResponse(**datos)

    # Assert
    assert len(response.personas) == 1
    assert "Altura" in response.aptitudes
