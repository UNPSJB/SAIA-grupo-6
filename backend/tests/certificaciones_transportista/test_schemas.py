"""Tests de validación de schemas de certificaciones."""

from datetime import date

import pytest
from pydantic import ValidationError

from src.certificaciones_transportista import exceptions
from src.certificaciones_transportista.schemas import (
    CertificacionTransportistaAnular,
    CertificacionTransportistaCreate,
    CertificacionTransportistaUpdate,
)


def _datos(**cambios):
    base = {
        "tipo": "SENASA",
        "numero": "SENASA-2026-001",
        "fecha_emision": date(2026, 1, 1),
        "fecha_vencimiento": date(2026, 12, 31),
    }
    base.update(cambios)
    return base


def test_create_valido():
    datos = CertificacionTransportistaCreate(**_datos())

    assert datos.tipo == "SENASA"
    assert datos.fecha_vencimiento >= datos.fecha_emision


def test_create_permite_vencimiento_igual_a_emision():
    datos = CertificacionTransportistaCreate(
        **_datos(fecha_emision=date(2026, 1, 1), fecha_vencimiento=date(2026, 1, 1))
    )

    assert datos.fecha_vencimiento == datos.fecha_emision


def test_create_rechaza_vencimiento_anterior_a_emision():
    with pytest.raises(exceptions.FechaVencimientoInvalida):
        CertificacionTransportistaCreate(
            **_datos(
                fecha_emision=date(2026, 2, 1),
                fecha_vencimiento=date(2026, 1, 1),
            )
        )


def test_create_rechaza_tipo_vacio():
    with pytest.raises(exceptions.TipoVacio):
        CertificacionTransportistaCreate(**_datos(tipo="   "))


def test_create_rechaza_numero_vacio():
    with pytest.raises(exceptions.NumeroVacio):
        CertificacionTransportistaCreate(**_datos(numero="   "))


def test_update_solo_acepta_observaciones():
    datos = CertificacionTransportistaUpdate(observaciones="  actualizada  ")

    assert datos.observaciones == "actualizada"


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("tipo", "OTRO"),
        ("numero", "OTRO-1"),
        ("fecha_emision", date(2026, 1, 2)),
        ("fecha_vencimiento", date(2026, 12, 30)),
        ("activa", False),
    ],
)
def test_update_rechaza_campos_inmutables(campo, valor):
    with pytest.raises(ValidationError):
        CertificacionTransportistaUpdate(**{campo: valor})


def test_anular_exige_motivo():
    with pytest.raises(exceptions.MotivoAnulacionRequerido):
        CertificacionTransportistaAnular(motivo="   ")


def test_anular_acepta_motivo():
    datos = CertificacionTransportistaAnular(motivo="  error de carga  ")

    assert datos.motivo == "error de carga"
