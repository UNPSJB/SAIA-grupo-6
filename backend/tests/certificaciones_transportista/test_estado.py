"""Tests del cálculo de estados de certificaciones (sin base de datos)."""

from dataclasses import dataclass
from datetime import date

from src.certificaciones_transportista.estado import (
    ESTADO_ANULADA,
    ESTADO_CERTIFICACION_VENCIDA,
    ESTADO_HABILITADO,
    ESTADO_REEMPLAZADA,
    ESTADO_SIN_CERTIFICACIONES,
    ESTADO_VENCIDA,
    ESTADO_VIGENTE,
    estado_certificacion,
    estado_habilitacion,
)


@dataclass
class CertificacionFalsa:
    activa: bool = True
    anulada: bool = False
    fecha_vencimiento: date = date(2026, 1, 10)


def test_sin_certificaciones():
    assert (
        estado_habilitacion([], date(2026, 1, 10))
        == ESTADO_SIN_CERTIFICACIONES
    )


def test_una_certificacion_vigente():
    certificaciones = [CertificacionFalsa()]

    assert estado_habilitacion(certificaciones, date(2026, 1, 10)) == ESTADO_HABILITADO


def test_una_vencida_entre_varias_vigentes():
    certificaciones = [
        CertificacionFalsa(fecha_vencimiento=date(2026, 1, 10)),
        CertificacionFalsa(fecha_vencimiento=date(2026, 1, 9)),
        CertificacionFalsa(fecha_vencimiento=date(2026, 2, 1)),
    ]

    assert (
        estado_habilitacion(certificaciones, date(2026, 1, 10))
        == ESTADO_CERTIFICACION_VENCIDA
    )


def test_todas_vigentes():
    certificaciones = [
        CertificacionFalsa(fecha_vencimiento=date(2026, 1, 10)),
        CertificacionFalsa(fecha_vencimiento=date(2026, 2, 1)),
    ]

    assert estado_habilitacion(certificaciones, date(2026, 1, 10)) == ESTADO_HABILITADO


def test_ignora_inactivas_y_anuladas():
    certificaciones = [
        CertificacionFalsa(activa=False, fecha_vencimiento=date(2026, 2, 1)),
        CertificacionFalsa(anulada=True, fecha_vencimiento=date(2026, 2, 1)),
    ]

    assert (
        estado_habilitacion(certificaciones, date(2026, 1, 10))
        == ESTADO_SIN_CERTIFICACIONES
    )


def test_el_dia_del_vencimiento_sigue_vigente():
    certificacion = CertificacionFalsa(fecha_vencimiento=date(2026, 1, 10))

    assert estado_certificacion(certificacion, date(2026, 1, 10)) == ESTADO_VIGENTE


def test_al_dia_siguiente_esta_vencida():
    certificacion = CertificacionFalsa(fecha_vencimiento=date(2026, 1, 10))

    assert estado_certificacion(certificacion, date(2026, 1, 11)) == ESTADO_VENCIDA


def test_estado_anulada_prevalece_sobre_activa():
    certificacion = CertificacionFalsa(activa=True, anulada=True)

    assert estado_certificacion(certificacion, date(2026, 1, 10)) == ESTADO_ANULADA


def test_estado_reemplazada():
    certificacion = CertificacionFalsa(activa=False, anulada=False)

    assert estado_certificacion(certificacion, date(2026, 1, 10)) == ESTADO_REEMPLAZADA
