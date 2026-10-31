import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from src.lotes.models import ESTADO_PENDIENTE, LoteProduccion
from src.lotes.schemas import LoteCreate, LoteResponse


def _datos(**cambios):
    base = {
        "codigo_lote": "L-001",
        "producto_nombre": "Pan",
        "cantidad_planificada": 100,
    }
    base.update(cambios)
    return base


def test_alta_lote_recorta_datos_y_aplica_defaults(db_session):
    datos = LoteCreate(**_datos(codigo_lote=" L-001 ", producto_nombre=" Pan "))
    lote = LoteProduccion(**datos.model_dump())

    db_session.add(lote)
    db_session.commit()
    db_session.refresh(lote)

    assert lote.id is not None
    assert lote.codigo_lote == "L-001"
    assert lote.producto_nombre == "Pan"
    assert lote.cantidad_planificada == 100
    assert lote.cantidad_producida == 0
    assert lote.estado == ESTADO_PENDIENTE
    assert lote.fecha_inicio is not None


def test_codigo_lote_duplicado_es_rechazado(db_session):
    db_session.add(LoteProduccion(**_datos()))
    db_session.commit()

    db_session.add(LoteProduccion(**_datos(producto_nombre="Otro producto")))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "cambios",
    [
        {"codigo_lote": "   "},
        {"producto_nombre": "   "},
        {"cantidad_planificada": 0},
        {"cantidad_planificada": -1},
    ],
)
def test_datos_invalidos_son_rechazados_por_el_esquema(cambios):
    with pytest.raises(ValidationError):
        LoteCreate(**_datos(**cambios))


@pytest.mark.parametrize(
    "cambios",
    [
        {"cantidad_producida": -1},
        {"estado": "Estado inexistente"},
    ],
)
def test_restricciones_de_la_base_rechazan_datos_invalidos(db_session, cambios):
    db_session.add(LoteProduccion(**_datos(**cambios)))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_respuesta_se_construye_desde_el_modelo(db_session):
    lote = LoteProduccion(**_datos())
    db_session.add(lote)
    db_session.commit()
    db_session.refresh(lote)

    respuesta = LoteResponse.model_validate(lote)

    assert respuesta.id == lote.id
    assert respuesta.codigo_lote == "L-001"
    assert respuesta.producto_nombre == "Pan"
    assert respuesta.cantidad_planificada == 100
    assert respuesta.cantidad_producida == 0
    assert respuesta.estado == ESTADO_PENDIENTE
    assert respuesta.fecha_inicio == lote.fecha_inicio
