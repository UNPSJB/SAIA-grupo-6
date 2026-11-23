"""Reglas puras del plan de acción (sin base de datos)."""

from datetime import date

import pytest

from src.notificaciones import riesgo
from src.planes_accion import reglas
from src.planes_accion.constants import EstadoPlan, EstadoSituacionPlan

HOY = date(2026, 11, 23)
E = EstadoSituacionPlan


# --- Estados --------------------------------------------------------------

def test_los_estados_activos_ocupan_situaciones_y_los_cerrados_no():
    for estado in ("borrador", "en_ejecucion", "implementado", "en_verificacion"):
        assert reglas.es_activo(estado)
    for estado in ("cerrado_eficaz", "cerrado_parcial", "cerrado_no_eficaz", "cancelado"):
        assert not reglas.es_activo(estado)


def test_solo_se_edita_en_borrador_y_en_ejecucion():
    assert reglas.es_editable("borrador") and reglas.es_editable("en_ejecucion")
    assert not reglas.es_editable("implementado")
    assert not reglas.es_editable("en_verificacion")


def test_se_cancela_hasta_implementado_pero_no_en_verificacion():
    assert reglas.es_cancelable("borrador")
    assert reglas.es_cancelable("en_ejecucion")
    assert reglas.es_cancelable("implementado")
    assert not reglas.es_cancelable("en_verificacion")
    assert not reglas.es_cancelable("cerrado_eficaz")


def test_acepta_el_enum_o_el_texto():
    assert reglas.es_activo(EstadoPlan.EN_EJECUCION)
    assert reglas.es_cerrado(EstadoPlan.CERRADO_PARCIAL)


# --- Vencimiento ----------------------------------------------------------

def test_el_plan_vence_si_pasa_el_plazo_sin_llegar_a_implementado():
    ayer = date(2026, 11, 22)
    assert reglas.plan_vencido(ayer, HOY, "en_ejecucion")
    assert reglas.plan_vencido(ayer, HOY, "borrador")
    assert not reglas.plan_vencido(ayer, HOY, "implementado")
    assert not reglas.plan_vencido(HOY, HOY, "en_ejecucion")  # vence mañana, no hoy
    assert not reglas.plan_vencido(None, HOY, "en_ejecucion")


def test_la_accion_vence_solo_si_no_esta_completada():
    ayer = date(2026, 11, 22)
    assert reglas.accion_vencida(ayer, False, HOY, "en_ejecucion")
    assert not reglas.accion_vencida(ayer, True, HOY, "en_ejecucion")
    assert not reglas.accion_vencida(ayer, False, HOY, "cancelado")


# --- Sugerencia -----------------------------------------------------------

@pytest.mark.parametrize(
    "criticidad, recurrencia, esperado",
    [("alta", 1, True), ("media", 3, True), ("baja", 3, True),
     ("media", 2, False), ("baja", 1, False), (None, None, False)],
)
def test_se_sugiere_plan_con_riesgo_alto_o_recurrencia_elevada(criticidad, recurrencia, esperado):
    assert reglas.sugerir_plan(criticidad, recurrencia) is esperado


# --- Verificación ---------------------------------------------------------

def test_si_el_motor_ya_no_la_detecta_queda_corregida():
    assert reglas.decidir_verificacion(tipo="PLAGAS", sigue_presente=False) == E.CORREGIDA


def test_si_el_motor_la_sigue_detectando_queda_no_eficaz():
    assert reglas.decidir_verificacion(tipo="PLAGAS", sigue_presente=True) == E.NO_EFICAZ


def test_en_un_tipo_detectado_por_el_motor_no_se_puede_forzar_el_resultado():
    # Aunque el usuario mande "corregida", manda lo que el motor detecta.
    assert (
        reglas.decidir_verificacion(
            tipo="PLAGAS", sigue_presente=True, resultado_manual="corregida"
        )
        == E.NO_EFICAZ
    )


def test_un_tipo_manual_exige_resultado_valido(monkeypatch):
    monkeypatch.setattr(reglas, "TIPOS_VERIFICACION_MANUAL", frozenset({"CARGADO_A_MANO"}))
    assert reglas.es_verificacion_manual("CARGADO_A_MANO")
    assert (
        reglas.decidir_verificacion(
            tipo="CARGADO_A_MANO", sigue_presente=True, resultado_manual="corregida"
        )
        == E.CORREGIDA
    )
    with pytest.raises(ValueError):
        reglas.decidir_verificacion(tipo="CARGADO_A_MANO", sigue_presente=False)
    with pytest.raises(ValueError):
        reglas.decidir_verificacion(
            tipo="CARGADO_A_MANO", sigue_presente=False, resultado_manual="eficaz"
        )


def test_todos_los_tipos_actuales_los_detecta_el_motor():
    assert all(not reglas.es_verificacion_manual(t) for t in riesgo.TIPOS_SITUACION)


def test_la_verificacion_esta_completa_cuando_ninguna_queda_pendiente():
    assert reglas.verificacion_completa([E.CORREGIDA, E.NO_EFICAZ])
    assert not reglas.verificacion_completa([E.CORREGIDA, E.ACCION_IMPLEMENTADA])
    assert not reglas.verificacion_completa([E.PENDIENTE])
    assert not reglas.verificacion_completa([])


def test_todas_no_eficaces():
    assert reglas.todas_no_eficaces([E.NO_EFICAZ, E.NO_EFICAZ])
    assert not reglas.todas_no_eficaces([E.NO_EFICAZ, E.CORREGIDA])
    assert not reglas.todas_no_eficaces([])


# --- Cierre ---------------------------------------------------------------

def test_el_cierre_depende_del_conjunto():
    assert reglas.resultado_de_cierre([E.EFICAZ, E.EFICAZ]) == EstadoPlan.CERRADO_EFICAZ
    assert reglas.resultado_de_cierre([E.EFICAZ, E.NO_EFICAZ]) == EstadoPlan.CERRADO_PARCIAL
    assert reglas.resultado_de_cierre([E.NO_EFICAZ, E.NO_EFICAZ]) == EstadoPlan.CERRADO_NO_EFICAZ


def test_un_plan_sin_situaciones_no_tiene_resultado():
    with pytest.raises(ValueError):
        reglas.resultado_de_cierre([])


# --- Período de observación -------------------------------------------------

def test_el_periodo_de_observacion_no_puede_ser_menor_que_la_ventana_de_recurrencia():
    assert reglas.DIAS_OBSERVACION_MINIMO == riesgo.DIAS_VENTANA_RECURRENCIA
    assert reglas.dias_observacion_validos(riesgo.DIAS_VENTANA_RECURRENCIA)
    assert not reglas.dias_observacion_validos(riesgo.DIAS_VENTANA_RECURRENCIA - 1)
    assert not reglas.dias_observacion_validos(366)
    assert reglas.dias_observacion_validos(365)


def test_la_observacion_termina_el_dia_que_se_cumple_el_plazo():
    fin = reglas.fin_observacion(date(2026, 11, 1), 30)
    assert fin == date(2026, 12, 1)
    assert not reglas.observacion_terminada(date(2026, 11, 30), fin)
    assert reglas.observacion_terminada(date(2026, 12, 1), fin)
    assert not reglas.observacion_terminada(HOY, None)


# --- Clave de la notificación ----------------------------------------------

def test_la_clave_de_una_situacion_se_busca_con_y_sin_prefijo():
    assert reglas.claves_de_notificacion("notificacion-elem-5") == ["notificacion-elem-5", "elem-5"]
    assert reglas.claves_de_notificacion("incidente-7") == ["incidente-7"]
    assert reglas.coincide_con_clave("notificacion-elem-5", "elem-5")
    assert not reglas.coincide_con_clave("incidente-7", "incidente-8")
