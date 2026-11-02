"""Tests unitarios de validadores de schemas del módulo `vencimientoPersonal`."""

import pytest
from datetime import date

from src.vencimientoPersonal import exceptions
from src.vencimientoPersonal.schemas import VencimientoPersonalCreate, VencimientoPersonalUpdate


def test_vencimiento_create_valido():
    # Arrange (fecha futura respecto a hoy)
    datos = {"persona_id": 1, "aptitud_id": 1, "fecha_vencimiento": date(2027, 12, 31)}

    # Act
    v = VencimientoPersonalCreate(**datos)

    # Assert
    assert v.persona_id == 1
    assert v.aptitud_id == 1


def test_vencimiento_create_fecha_pasada_lanza_error():
    # Arrange (fecha anterior a hoy)
    datos = {"persona_id": 1, "aptitud_id": 1, "fecha_vencimiento": date(2020, 1, 1)}

    # Act / Assert
    with pytest.raises(exceptions.FechaVencimientoPasada):
        VencimientoPersonalCreate(**datos)


def test_vencimiento_create_fecha_hoy_valida():
    # Arrange (fecha futuro, valida)
    datos = {"persona_id": 1, "aptitud_id": 1, "fecha_vencimiento": date(2027, 12, 31)}

    # Act
    v = VencimientoPersonalCreate(**datos)

    # Assert
    assert v.fecha_vencimiento == date(2027, 12, 31)


def test_vencimiento_update_fecha_pasada_lanza_error():
    # Arrange
    datos = {"fecha_vencimiento": date(2020, 1, 1)}

    # Act / Assert
    with pytest.raises(exceptions.FechaVencimientoPasada):
        VencimientoPersonalUpdate(**datos)


def test_vencimiento_update_no_existe_schema_valido():
    # Arrange (fecha futura)
    datos = {"fecha_vencimiento": date(2027, 12, 31)}

    # Act
    u = VencimientoPersonalUpdate(**datos)

    # Assert
    assert u.fecha_vencimiento == date(2027, 12, 31)
