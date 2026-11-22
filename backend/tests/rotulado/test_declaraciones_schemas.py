import pytest
from pydantic import ValidationError

from src.alergenos import exceptions as alergenos_exceptions
from src.alergenos.schemas import AlergenoDeIngredienteIn, AlergenosDeIngredienteIn
from src.rotulado.declaraciones_schemas import ConservacionProducto


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


def test_lista_vacia_no_cambia_la_evaluacion():
    # Una lista vacía no afirma ausencia de alérgenos: la evaluación que no
    # viene queda como estaba (la del ingrediente arranca "sin_evaluar").
    datos = AlergenosDeIngredienteIn(alergenos=[])
    assert datos.evaluacion is None and datos.gluten is None


def test_derivado_solo_para_lo_que_contiene():
    assert AlergenoDeIngredienteIn(alergeno_id=1, nivel="contiene", forma="derivado").forma == "derivado"
    with pytest.raises(alergenos_exceptions.DerivadoSoloContiene):
        AlergenoDeIngredienteIn(alergeno_id=1, nivel="puede_contener", forma="derivado")
