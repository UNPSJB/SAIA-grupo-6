"""Tests unitarios de validadores de schemas del módulo `PlanLimpieza`."""

import pytest
from datetime import datetime

from src.PlanLimpieza import exceptions
from src.PlanLimpieza.schemas import PlanLimpiezaCreate, PlanLimpiezaUpdate
from src.tareas.schemas import TareaBase as TareaInput


def _tarea_input(nombre="TareaUno", frecuencia=7):
    return TareaInput(nombre=nombre, frecuencia=frecuencia, tipo="operacional")


def test_plan_limpieza_create_valido():
    # Arrange
    datos = {
        "nombre": "Plan Mensual",
        "equipo_id": 1,
        "tareas": [_tarea_input("Limpiar pisos", 7)],
    }

    # Act
    plan = PlanLimpiezaCreate(**datos)

    # Assert
    assert plan.nombre == "Plan Mensual"
    assert plan.equipo_id == 1
    assert len(plan.tareas) == 1


def test_plan_limpieza_create_nombre_vacio():
    # Arrange
    datos = {
        "nombre": "   ",
        "equipo_id": 1,
        "tareas": [_tarea_input()],
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        PlanLimpiezaCreate(**datos)


def test_plan_limpieza_create_nombre_caracteres_invalidos():
    # Arrange (RE_NOMBRE_SOLO_LETRAS)
    datos = {
        "nombre": "Plan 123!",
        "equipo_id": 1,
        "tareas": [_tarea_input()],
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        PlanLimpiezaCreate(**datos)


def test_plan_limpieza_create_tareas_vacias():
    # Arrange
    datos = {
        "nombre": "Plan",
        "equipo_id": 1,
        "tareas": [],
    }

    # Act / Assert
    with pytest.raises(exceptions.TareasVacias):
        PlanLimpiezaCreate(**datos)


def test_plan_limpieza_create_equipo_id_cero():
    # Arrange (id_positivo)
    datos = {
        "nombre": "Plan",
        "equipo_id": 0,
        "tareas": [_tarea_input()],
    }

    # Act / Assert
    with pytest.raises(exceptions.EquipoIdInvalido):
        PlanLimpiezaCreate(**datos)


def test_plan_limpieza_update_parcial_solo_nombre():
    # Arrange
    datos = {"nombre": "Plan Actualizado"}

    # Act
    update = PlanLimpiezaUpdate(**datos)

    # Assert
    assert update.nombre == "Plan Actualizado"
    assert update.tareas is None
    assert update.equipo_id is None


def test_plan_limpieza_update_tareas_vacias():
    # Arrange
    datos = {"tareas": []}

    # Act / Assert
    with pytest.raises(exceptions.TareasVacias):
        PlanLimpiezaUpdate(**datos)


@pytest.mark.parametrize(
    "nombre",
    ["PlanLimpieza", "Plan Mensual", "Plan de Limpieza"],
)
def test_plan_limpieza_create_nombres_validos(nombre):
    # Arrange
    datos = {
        "nombre": nombre,
        "equipo_id": 1,
        "tareas": [_tarea_input()],
    }

    # Act
    plan = PlanLimpiezaCreate(**datos)

    # Assert
    assert plan.nombre == nombre


@pytest.mark.parametrize(
    "nombre",
    ["", "   ", "Plan!@#"],
)
def test_plan_limpieza_create_nombres_invalidos(nombre):
    # Arrange
    datos = {
        "nombre": nombre,
        "equipo_id": 1,
        "tareas": [_tarea_input()],
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        PlanLimpiezaCreate(**datos)
