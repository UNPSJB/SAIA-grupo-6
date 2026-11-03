"""Tests unitarios de validadores de schemas del módulo `tareas`."""

import pytest

from src.tareas import exceptions
from src.tareas.schemas import TareaCreate, TareaUpdate, TareaEnPlanInput
from src.tareas.constants import TipoTarea


def test_tarea_create_valido():
    # Arrange
    datos = {
        "nombre": "Limpiar pisos",
        "frecuencia": 7,
        "tipo": TipoTarea.OPERACIONAL.value,
        "plan_limpieza_id": 1,
    }

    # Act
    tarea = TareaCreate(**datos)

    # Assert
    assert tarea.nombre == "Limpiar pisos"
    assert tarea.frecuencia == 7


def test_tarea_create_nombre_vacio():
    # Arrange
    datos = {
        "nombre": "   ",
        "frecuencia": 7,
        "tipo": TipoTarea.OPERACIONAL.value,
        "plan_limpieza_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        TareaCreate(**datos)


def test_tarea_create_frecuencia_cero():
    # Arrange (id_positivo)
    datos = {
        "nombre": "Limpiar",
        "frecuencia": 0,
        "tipo": TipoTarea.OPERACIONAL.value,
        "plan_limpieza_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.FrecuenciaInvalida):
        TareaCreate(**datos)


def test_tarea_create_tipo_invalido():
    # Arrange
    datos = {
        "nombre": "Limpiar",
        "frecuencia": 7,
        "tipo": "invalido",
        "plan_limpieza_id": 1,
    }

    # Act / Assert
    with pytest.raises(exceptions.TipoInvalido):
        TareaCreate(**datos)


def test_tarea_create_plan_limpieza_id_cero():
    # Arrange
    datos = {
        "nombre": "Limpiar",
        "frecuencia": 7,
        "tipo": TipoTarea.OPERACIONAL.value,
        "plan_limpieza_id": 0,
    }

    # Act / Assert
    with pytest.raises(exceptions.PlanLimpiezaIdInvalido):
        TareaCreate(**datos)


def test_tarea_update_parcial_solo_frecuencia():
    # Arrange
    datos = {"frecuencia": 14}

    # Act
    update = TareaUpdate(**datos)

    # Assert
    assert update.frecuencia == 14
    assert update.nombre is None


def test_tarea_update_nombre_vacio():
    # Arrange
    datos = {"nombre": "   "}

    # Act / Assert
    with pytest.raises(exceptions.NombreInvalido):
        TareaUpdate(**datos)


def test_tarea_en_plan_input_con_id():
    # Arrange
    datos = {
        "id": 1,
        "nombre": "Tarea Existente",
        "frecuencia": 7,
        "tipo": TipoTarea.OPERACIONAL.value,
    }

    # Act
    tarea = TareaEnPlanInput(**datos)

    # Assert
    assert tarea.id == 1
    assert tarea.nombre == "Tarea Existente"


def test_tarea_en_plan_input_sin_id():
    # Arrange
    datos = {
        "nombre": "Tarea Nueva",
        "frecuencia": 7,
        "tipo": TipoTarea.OPERACIONAL.value,
    }

    # Act
    tarea = TareaEnPlanInput(**datos)

    # Assert
    assert tarea.id is None
    assert tarea.nombre == "Tarea Nueva"


@pytest.mark.parametrize(
    "tipo",
    ["preoperacional", "operacional", "postoperacional"],
)
def test_tarea_create_tipos_validos(tipo):
    # Arrange
    datos = {
        "nombre": "Limpiar",
        "frecuencia": 7,
        "tipo": tipo,
        "plan_limpieza_id": 1,
    }

    # Act
    tarea = TareaCreate(**datos)

    # Assert
    assert tarea.tipo == tipo
