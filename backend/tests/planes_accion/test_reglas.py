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
    assert reglas.decidir_verificacion(tipo="STOCK_BAJO", sigue_presente=False) == E.CORREGIDA


def test_si_el_motor_la_sigue_detectando_queda_no_eficaz():
    assert reglas.decidir_verificacion(tipo="STOCK_BAJO", sigue_presente=True) == E.NO_EFICAZ


def test_en_un_tipo_detectado_por_el_motor_no_se_puede_forzar_el_resultado():
    # Aunque el usuario mande "corregida", manda lo que el motor detecta.
    assert (
        reglas.decidir_verificacion(
            tipo="STOCK_BAJO", sigue_presente=True, resultado_manual="corregida"
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


def test_solo_los_incidentes_se_verifican_a_mano():
    # Un incidente sigue abierto aunque la causa esté corregida: la confirmación
    # la da una persona. Lo demás lo observa el motor.
    manuales = {t for t in riesgo.TIPOS_SITUACION if reglas.es_verificacion_manual(t)}
    assert manuales == set(riesgo.TIPOS_DE_INCIDENTE)
    assert not reglas.es_verificacion_manual("STOCK_BAJO")
    assert not reglas.es_verificacion_manual("PLAN_CALIBRACION_VENCIDO")


def test_un_incidente_se_verifica_con_el_resultado_que_indica_quien_verifica():
    assert (
        reglas.decidir_verificacion(
            tipo="PLAGAS", sigue_presente=True, resultado_manual="corregida"
        )
        == E.CORREGIDA
    )
    assert (
        reglas.decidir_verificacion(
            tipo="PLAGAS", sigue_presente=True, resultado_manual="no_eficaz"
        )
        == E.NO_EFICAZ
    )


# --- Situación controlada (la marca el motor; su riesgo real no cambia) -------------

@pytest.mark.parametrize("estado_plan", ["implementado", "en_verificacion", "cerrado_eficaz", "cerrado_parcial"])
@pytest.mark.parametrize("estado_sit", ["corregida", "eficaz"])
def test_una_situacion_verificada_de_un_plan_en_pie_esta_controlada(estado_plan, estado_sit):
    assert reglas.situacion_controlada(estado_plan, estado_sit)


@pytest.mark.parametrize("estado_plan", ["borrador", "en_ejecucion", "cancelado", "cerrado_no_eficaz"])
def test_un_plan_que_no_llego_a_verificar_o_fallo_no_controla_nada(estado_plan):
    assert not reglas.situacion_controlada(estado_plan, "corregida")


@pytest.mark.parametrize("estado_sit", ["pendiente", "accion_implementada", "no_eficaz"])
def test_sin_verificar_o_no_eficaz_no_esta_controlada(estado_sit):
    assert not reglas.situacion_controlada("en_verificacion", estado_sit)


def test_el_motor_no_tiene_ninguna_evaluacion_especial_para_lo_controlado():
    # El riesgo real se calcula siempre igual: no hay atajo "tratado" en el motor.
    assert not hasattr(riesgo, "evaluar_situacion_tratada")
    assert not hasattr(riesgo, "riesgo_tratado")


# --- Tipos mezclados en un plan ---------------------------------------------------

def test_mismo_tipo_siempre_es_compatible():
    assert reglas.es_compatible(
        tipo_plan="PLAGAS", elementos_alcance=["equipo:1"], tipo="PLAGAS", elemento="equipo:9"
    )


def test_otro_tipo_solo_es_compatible_si_es_de_un_elemento_del_alcance():
    kw = dict(tipo_plan="FALLA_EQUIPO", elementos_alcance=["equipo:1"])
    assert reglas.es_compatible(**kw, tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    assert not reglas.es_compatible(**kw, tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:2")
