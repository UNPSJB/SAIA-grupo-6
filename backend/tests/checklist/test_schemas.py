"""Tests unitarios de validadores de schemas del módulo `checklist`."""

import pytest
from datetime import date, datetime
from decimal import Decimal

from src.checklist import exceptions
from src.checklist.models import EstadoChecklist
from src.checklist.schemas import (
    ChecklistTareaItem,
    ChecklistResponse,
    RegistroTareaUpdate,
    RegistroTareaResponse,
    TareaDelDiaItem,
    TareasDelDiaResponse,
    HistorialRegistroTareaItem,
    HistorialRegistroTareaResponse,
    HistorialChecklistItem,
    HistorialChecklistResponse,
    DetalleChecklistTareaItem,
    DetalleChecklistResponse,
    ConsumoInsumoItem,
    ConsumoPorFechaItem,
    ConsumoPorUnidadItem,
    ConsumoInsumosResponse,
    CoberturaTareaResponse,
)


def test_checklist_tarea_item_valido():
    # Arrange
    datos = {
        "id": 1,
        "registro_id": 1,
        "nombre": "Limpiar pisos",
        "plan_limpieza_id": 1,
        "completado": False,
    }

    # Act
    item = ChecklistTareaItem(**datos)

    # Assert
    assert item.nombre == "Limpiar pisos"
    assert item.completado is False


def test_checklist_response_valido():
    # Arrange
    datos = {
        "checklist_id": 1,
        "fecha": date(2025, 6, 10),
        "equipo_id": 1,
        "plan_id": 1,
        "plan_nombre": "Plan Limpieza",
        "estado": EstadoChecklist.ABIERTO,
        "tareas": [],
    }

    # Act
    response = ChecklistResponse(**datos)

    # Assert
    assert response.estado == EstadoChecklist.ABIERTO
    assert response.tareas == []


def test_registro_tarea_update_valido():
    # Arrange
    datos = {"completado": True}

    # Act
    update = RegistroTareaUpdate(**datos)

    # Assert
    assert update.completado is True


def test_registro_tarea_update_cantidad_cero():
    # Arrange (gt=0)
    datos = {
        "completado": True,
        "cantidad_consumida": Decimal("0"),
    }

    # Act / Assert
    with pytest.raises(Exception):
        RegistroTareaUpdate(**datos)


def test_registro_tarea_response_valido():
    # Arrange
    datos = {
        "id": 1,
        "checklist_id": 1,
        "tarea_id": 1,
        "nombre_tarea_historico": "Limpiar",
        "completado": False,
    }

    # Act
    response = RegistroTareaResponse(**datos)

    # Assert
    assert response.id == 1
    assert response.completado is False


def test_tarea_del_dia_item_valido():
    # Arrange
    datos = {
        "id": 1,
        "registro_id": 1,
        "nombre": "Limpiar",
        "plan_nombre": "Plan",
        "equipo_id": 1,
        "equipo_nombre": "Equipo",
        "completado": False,
    }

    # Act
    item = TareaDelDiaItem(**datos)

    # Assert
    assert item.nombre == "Limpiar"


def test_historial_registro_tarea_item_valido():
    # Arrange
    datos = {
        "id": 1,
        "completado": True,
        "fecha_evento": datetime(2025, 6, 10, 10, 0),
    }

    # Act
    item = HistorialRegistroTareaItem(**datos)

    # Assert
    assert item.completado is True


def test_historial_checklist_item_valido():
    # Arrange
    datos = {
        "checklist_id": 1,
        "fecha": date(2025, 6, 10),
        "equipo_id": 1,
        "equipo_nombre": "Equipo",
        "estado": EstadoChecklist.COMPLETO,
        "total_tareas": 5,
        "tareas_completadas": 5,
        "porcentaje_cumplimiento": 100.0,
        "tareas_incumplidas": [],
    }

    # Act
    item = HistorialChecklistItem(**datos)

    # Assert
    assert item.porcentaje_cumplimiento == 100.0


def test_historial_checklist_response_valido():
    # Arrange
    datos = {
        "fecha_desde": date(2025, 6, 1),
        "fecha_hasta": date(2025, 6, 10),
        "porcentaje_cumplimiento_general": 80.0,
        "checklists": [],
    }

    # Act
    response = HistorialChecklistResponse(**datos)

    # Assert
    assert response.porcentaje_cumplimiento_general == 80.0


def test_detalle_checklist_response_valido():
    # Arrange
    datos = {
        "checklist_id": 1,
        "fecha": date(2025, 6, 10),
        "equipo_id": 1,
        "equipo_nombre": "Equipo",
        "estado": EstadoChecklist.ABIERTO,
        "total_tareas": 3,
        "tareas_completadas": 2,
        "porcentaje_cumplimiento": 66.67,
        "tareas": [],
    }

    # Act
    response = DetalleChecklistResponse(**datos)

    # Assert
    assert response.porcentaje_cumplimiento == 66.67


def test_consumo_insumo_item_valido():
    # Arrange
    datos = {
        "insumo_quimico_id": 1,
        "nombre": "Detergente",
        "unidad_simbolo": "kg",
        "cantidad_total": 10.5,
        "cantidad_registros": 2,
    }

    # Act
    item = ConsumoInsumoItem(**datos)

    # Assert
    assert item.cantidad_total == 10.5


def test_consumo_insumos_response_valido():
    # Arrange
    datos = {
        "fecha_desde": date(2025, 6, 1),
        "fecha_hasta": date(2025, 6, 10),
        "insumos": [],
        "totales_por_unidad": [],
        "por_producto_fecha": [],
    }

    # Act
    response = ConsumoInsumosResponse(**datos)

    # Assert
    assert response.insumos == []


def test_cobertura_tarea_response_valido():
    # Arrange
    datos = {
        "registro_id": 1,
        "operador_id": 1,
        "reemplazado_por_id": 2,
    }

    # Act
    response = CoberturaTareaResponse(**datos)

    # Assert
    assert response.registro_id == 1
    assert response.operador_id == 1
