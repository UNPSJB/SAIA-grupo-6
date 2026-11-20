import pytest
from pydantic import ValidationError

from src.rotulado.declaraciones_schemas import ConservacionProducto, PerfilInsumoDeclaracion


def test_temperaturas_negativas_y_duracion():
    datos = ConservacionProducto(
        temperatura_aplicable=True, temperatura_minima=-20, temperatura_maxima=-18,
        duracion_aplicable=True, duracion=6, unidad_duracion="meses",
        instrucciones="Conservar congelado.",
    )
    assert datos.pendientes() == []
    assert ConservacionProducto.model_validate_json(datos.model_dump_json()) == datos


@pytest.mark.parametrize("datos", [
    {"temperatura_minima": 4},
    {"temperatura_aplicable": True, "temperatura_minima": 8, "temperatura_maxima": 4},
    {"duracion_aplicable": True, "duracion": 0, "unidad_duracion": "dias"},
    {"duracion_aplicable": True, "duracion": 3},
    {"duracion_aplicable": True, "duracion": 3, "unidad_duracion": "minutos"},
    {"despues_abrir": {"instrucciones": "Refrigerar"}},
    {"confirmado_por_id": 1},
])
def test_condiciones_invalidas(datos):
    with pytest.raises(ValidationError):
        ConservacionProducto.model_validate(datos)


def test_faltantes_no_impiden_guardar():
    datos = ConservacionProducto(temperatura_aplicable=True, despues_abrir_aplicable=True)
    assert set(datos.pendientes()) == {"temperatura", "instrucciones", "despues_abrir"}


def test_lista_vacia_evaluada_es_distinta_de_desconocida():
    assert PerfilInsumoDeclaracion().evaluacion == "sin_evaluar"
    assert PerfilInsumoDeclaracion(evaluacion="evaluada").marcas == []
