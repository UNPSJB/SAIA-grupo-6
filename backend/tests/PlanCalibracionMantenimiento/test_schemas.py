"""Tests unitarios de validadores de schemas del módulo `PlanCalibracionMantenimiento`."""

import pytest
from datetime import date

from src.PlanCalibracionMantenimiento import exceptions
from src.PlanCalibracionMantenimiento.schemas import (
    PlanCalibracionMantenimientoCreate,
    PlanCalibracionMantenimientoUpdate,
)


def test_plan_calibracion_create_valido():
    # Arrange
    datos = {
        "equipo_id": 1,
        "tipo": "calibracion",
        "fecha_ultima_intervencion": date(2025, 1, 1),
        "periodicidad_dias": 90,
    }

    # Act
    plan = PlanCalibracionMantenimientoCreate(**datos)

    # Assert
    assert plan.equipo_id == 1
    assert plan.tipo == "calibracion"
    assert plan.periodicidad_dias == 90


def test_plan_calibracion_create_equipo_id_cero():
    # Arrange
    datos = {
        "equipo_id": 0,
        "tipo": "calibracion",
        "fecha_ultima_intervencion": date(2025, 1, 1),
        "periodicidad_dias": 90,
    }

    # Act / Assert
    with pytest.raises(exceptions.EquipoIdInvalido):
        PlanCalibracionMantenimientoCreate(**datos)


def test_plan_calibracion_create_periodicidad_cero():
    # Arrange (ge=1)
    datos = {
        "equipo_id": 1,
        "tipo": "calibracion",
        "fecha_ultima_intervencion": date(2025, 1, 1),
        "periodicidad_dias": 0,
    }

    # Act / Assert
    with pytest.raises(Exception):
        PlanCalibracionMantenimientoCreate(**datos)


def test_plan_calibracion_create_periodicidad_maxima_excedida():
    # Arrange (le=3650)
    datos = {
        "equipo_id": 1,
        "tipo": "calibracion",
        "fecha_ultima_intervencion": date(2025, 1, 1),
        "periodicidad_dias": 3651,
    }

    # Act / Assert
    with pytest.raises(Exception):
        PlanCalibracionMantenimientoCreate(**datos)


def test_plan_calibracion_update_parcial_solo_tipo():
    # Arrange
    datos = {"tipo": "mantenimiento"}

    # Act
    update = PlanCalibracionMantenimientoUpdate(**datos)

    # Assert
    assert update.tipo == "mantenimiento"
    assert update.equipo_id is None


def test_plan_calibracion_update_periodicidad_cero():
    # Arrange (ge=1)
    datos = {"periodicidad_dias": 0}

    # Act / Assert
    with pytest.raises(Exception):
        PlanCalibracionMantenimientoUpdate(**datos)


@pytest.mark.parametrize(
    "tipo",
    ["calibracion", "mantenimiento"],
)
def test_plan_calibracion_create_tipos_validos(tipo):
    # Arrange
    datos = {
        "equipo_id": 1,
        "tipo": tipo,
        "fecha_ultima_intervencion": date(2025, 1, 1),
        "periodicidad_dias": 30,
    }
