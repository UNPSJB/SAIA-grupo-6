"""Tests de la fórmula de riesgo (módulo puro: no necesita base de datos)."""

from datetime import date

import pytest

from src.notificaciones import riesgo
from src.notificaciones.riesgo import (
    TIPOS_SITUACION,
    criticidad_de,
    evaluar_situacion,
    fecha_deteccion_inicial,
    nivel_de,
    puntaje_persistencia,
    puntaje_recurrencia,
    redondear,
    riesgo_consolidado,
    tipo_situacion_de_incidente,
)


# ---------------------------------------------------------------------------
# Recurrencia y persistencia
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "detecciones, esperado",
    [(0, 1), (1, 1), (2, 1), (3, 2), (5, 2), (6, 3), (10, 3)],
)
def test_puntaje_recurrencia(detecciones, esperado):
    assert puntaje_recurrencia(detecciones) == esperado


@pytest.mark.parametrize(
    "dias, esperado",
    [(0, 1), (2, 1), (3, 2), (7, 2), (8, 3), (90, 3)],
)
def test_puntaje_persistencia(dias, esperado):
    assert puntaje_persistencia(dias) == esperado


def test_persistencia_puede_variar_por_tipo(monkeypatch):
    monkeypatch.setitem(riesgo.UMBRALES_PERSISTENCIA_POR_TIPO, "INCIDENTE_ABIERTO", (0, 1))
    assert puntaje_persistencia(2, "INCIDENTE_ABIERTO") == 3
    assert puntaje_persistencia(2, "DOCUMENTO_VENCIDO") == 1  # usa el valor por defecto


# ---------------------------------------------------------------------------
# Riesgo individual = Impacto × (0,7 × Recurrencia + 0,3 × Persistencia)
# ---------------------------------------------------------------------------

def test_primera_deteccion_de_impacto_alto_da_riesgo_bajo():
    """Lo advierte la propia propuesta (sección 10): 3 × 1 = 3, que es nivel bajo."""
    ev = evaluar_situacion(impacto=3, detecciones=1, dias_presente=0)
    assert ev.riesgo == 3.0
    assert ev.nivel == "bajo"


def test_impacto_bajo_nunca_pasa_de_bajo():
    ev = evaluar_situacion(impacto=1, detecciones=10, dias_presente=999)
    assert ev.riesgo == 3.0
    assert ev.nivel == "bajo"


def test_riesgo_maximo_es_nueve():
    ev = evaluar_situacion(impacto=3, detecciones=6, dias_presente=30)
    assert ev.riesgo == 9.0
    assert ev.nivel == "alto"


def test_dos_situaciones_del_mismo_tipo_pueden_tener_distinto_riesgo():
    nueva = evaluar_situacion(impacto=2, detecciones=1, dias_presente=0)
    vieja_y_repetida = evaluar_situacion(impacto=2, detecciones=6, dias_presente=10)
    assert nueva.riesgo == 2.0
    assert vieja_y_repetida.riesgo == 6.0


def test_ejemplo_con_decimales():
    # recurrencia 2 (1,4) + persistencia 2 (0,6) = 2,0 de probabilidad; impacto 3 → 6,0
    assert evaluar_situacion(impacto=3, detecciones=3, dias_presente=5).riesgo == 6.0
    # recurrencia 3 (2,1) + persistencia 1 (0,3) = 2,4; impacto 2 → 4,8
    ev = evaluar_situacion(impacto=2, detecciones=6, dias_presente=1)
    assert ev.probabilidad == 2.4
    assert ev.riesgo == 4.8


def test_la_deteccion_actual_siempre_cuenta():
    assert evaluar_situacion(impacto=2, detecciones=0, dias_presente=0).recurrencia == 1


@pytest.mark.parametrize("impacto", [0, 4, -1])
def test_impacto_fuera_de_rango_se_rechaza(impacto):
    with pytest.raises(ValueError):
        evaluar_situacion(impacto=impacto, detecciones=1, dias_presente=0)


# ---------------------------------------------------------------------------
# Riesgo consolidado = mín(9 ; más alto + 0,3 × promedio de los restantes)
# ---------------------------------------------------------------------------

def test_sin_situaciones_no_hay_riesgo():
    assert riesgo_consolidado([]) == 0.0
    assert nivel_de(0.0) == "sin_riesgo"


def test_una_sola_situacion_es_su_riesgo_individual():
    assert riesgo_consolidado([4.8]) == 4.8


def test_varias_situaciones():
    # 6 + 0,3 × mín(6 ; 3 + 3) = 7,8
    assert riesgo_consolidado([6.0, 3.0, 3.0]) == 7.8
    # el orden no importa
    assert riesgo_consolidado([3.0, 6.0, 3.0]) == 7.8


def test_una_situacion_leve_suma_poco():
    # 6 + 0,3 × mín(6 ; 1) = 6,3
    assert riesgo_consolidado([6.0, 1.0]) == 6.3
    # 6 + 0,3 × mín(6 ; 2) = 6,6
    assert riesgo_consolidado([6.0, 2.0]) == 6.6


def test_el_maximo_repetido_se_cuenta_una_sola_vez_como_mayor():
    # mayor 6; restantes [6] → 6 + 1,8 = 7,8
    assert riesgo_consolidado([6.0, 6.0]) == 7.8


def test_nunca_supera_nueve():
    assert riesgo_consolidado([9.0, 9.0, 9.0]) == 9.0


def test_ejemplo_de_la_propuesta_tope_de_30_por_ciento():
    """"Un elemento cuya peor situación tiene riesgo 3 no puede pasar de 3,9"."""
    assert riesgo_consolidado([3.0] * 50) == 3.9
    assert nivel_de(riesgo_consolidado([3.0] * 50)) == "medio"


def test_muchas_situaciones_leves_no_lo_vuelven_alto():
    assert nivel_de(riesgo_consolidado([1.0] * 100)) == "bajo"


def test_sumar_una_situacion_nunca_baja_el_riesgo_del_elemento():
    """Lo pidió el negocio: el riesgo solo baja si se resuelve algo, si el
    administrador cambia el impacto o (más adelante) si hay un plan de acción;
    nunca por el mero hecho de sumar una situación, por leve que sea."""
    bases = [
        [1.0],
        [3.0],
        [6.0],
        [9.0],
        [6.0, 6.0],
        [6.0, 3.0],
        [6.0, 3.0, 3.0],
        [4.2, 4.2, 4.2, 1.0],
        [9.0, 1.0, 1.0],
    ]
    nuevas = [1.0 + paso / 10 for paso in range(0, 81)]  # 1,0 a 9,0
    for base in bases:
        antes = riesgo_consolidado(base)
        for nueva in nuevas:
            despues = riesgo_consolidado(base + [nueva])
            assert despues >= antes, f"{base} + {nueva}: {antes} → {despues}"


def test_el_ejemplo_que_antes_bajaba_ahora_no_baja():
    """Con el promedio de la fórmula original, sumar un 1,0 bajaba de 7,8 a 7,1."""
    assert riesgo_consolidado([6.0, 6.0, 1.0]) >= riesgo_consolidado([6.0, 6.0])


def test_lo_que_se_suma_nunca_pasa_del_30_por_ciento_de_la_peor():
    for peor in (1.0, 2.5, 3.0, 4.8, 6.0, 7.2):
        assert riesgo_consolidado([peor] + [peor] * 40) <= redondear(peor * 1.3)


# ---------------------------------------------------------------------------
# Niveles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "puntaje, nivel",
    [
        (0.0, "sin_riesgo"),
        (1.0, "bajo"),
        (3.0, "bajo"),
        (3.1, "medio"),
        (6.0, "medio"),
        (6.1, "alto"),
        (9.0, "alto"),
    ],
)
def test_limites_de_los_niveles(puntaje, nivel):
    assert nivel_de(puntaje) == nivel


def test_criticidad_historica():
    assert criticidad_de("alto") == "alta"
    assert criticidad_de("medio") == "media"
    assert criticidad_de("bajo") == "baja"


# ---------------------------------------------------------------------------
# Redondeo y catálogo
# ---------------------------------------------------------------------------

def test_redondeo_mitades_hacia_arriba():
    assert redondear(2.25) == 2.3   # round() de Python daría 2.2
    assert redondear(7.05) == 7.1
    assert redondear(4.8) == 4.8


def test_las_clases_de_evento_que_generan_riesgo():
    assert list(TIPOS_SITUACION) == [
        "HIGIENE_CONTAMINACION",
        "FALLA_EQUIPO",
        "PLAGAS",
        "STOCK_BAJO",
        "CHECKLIST_INCOMPLETO",
        "OTROS",
        "DOCUMENTO_VENCIDO",
        "DOCUMENTO_PROXIMO",
        "VENCIMIENTO_PERSONAL_VENCIDO",
        "VENCIMIENTO_PERSONAL_PROXIMO",
        "PLAN_CALIBRACION_VENCIDO",
        "PLAN_CALIBRACION_PROXIMO",
        "PLAN_MANTENIMIENTO_VENCIDO",
        "PLAN_MANTENIMIENTO_PROXIMO",
        "ELEMENTO_LIMPIEZA_VENCIDO",
        "ELEMENTO_LIMPIEZA_PROXIMO",
    ]


def test_el_impacto_sugerido_replica_la_clasificacion_del_motor_anterior():
    por_tipo = {tipo: t.impacto_sugerido for tipo, t in TIPOS_SITUACION.items()}
    assert por_tipo == {
        "HIGIENE_CONTAMINACION": 3,
        "FALLA_EQUIPO": 3,
        "PLAGAS": 3,
        "STOCK_BAJO": 2,  # el motor anterior lo tenía como media
        "CHECKLIST_INCOMPLETO": 1,  # y esto como baja
        "OTROS": 3,
        **{t: 2 for t in TIPOS_SITUACION if t.endswith("_VENCIDO")},
        **{t: 1 for t in TIPOS_SITUACION if t.endswith("_PROXIMO")},
    }


def test_todos_los_vencimientos_generan_riesgo():
    for categoria in ("DOCUMENTO", "VENCIMIENTO_PERSONAL", "PLAN_CALIBRACION", "PLAN_MANTENIMIENTO", "ELEMENTO_LIMPIEZA"):
        assert f"{categoria}_VENCIDO" in TIPOS_SITUACION
        assert f"{categoria}_PROXIMO" in TIPOS_SITUACION


def test_un_incidente_de_otra_clase_no_esta_en_el_catalogo():
    assert "INCIDENTE_ABIERTO" not in TIPOS_SITUACION
    assert "INCIDENTE_ABIERTO" in riesgo.ETIQUETAS_SIN_RIESGO


def test_toda_regla_tiene_etiqueta():
    for regla in list(TIPOS_SITUACION) + list(riesgo.ETIQUETAS_SIN_RIESGO):
        assert riesgo.etiqueta_de(regla)
    assert riesgo.etiqueta_de("PLAGAS") == "Plagas"
    assert riesgo.etiqueta_de("DOCUMENTO_VENCIDO") == "Documento vencido"


# ---------------------------------------------------------------------------
# Desde cuándo está presente un evento que el motor ve por primera vez
# ---------------------------------------------------------------------------

HOY = date(2026, 11, 18)


@pytest.mark.parametrize("tipo", ["PLAGAS", "HIGIENE_CONTAMINACION", "FALLA_EQUIPO", "OTROS"])
def test_un_incidente_cuenta_desde_que_se_reporto(tipo):
    assert fecha_deteccion_inicial(tipo, date(2026, 11, 10), HOY) == date(2026, 11, 10)


def test_lo_vencido_cuenta_desde_el_dia_siguiente_al_vencimiento():
    assert fecha_deteccion_inicial("DOCUMENTO_VENCIDO", date(2026, 11, 10), HOY) == date(2026, 11, 11)


def test_lo_proximo_stock_y_checklist_cuentan_desde_hoy():
    assert fecha_deteccion_inicial("DOCUMENTO_PROXIMO", date(2026, 11, 25), HOY) == HOY
    assert fecha_deteccion_inicial("STOCK_BAJO", date(2026, 11, 1), HOY) == HOY
    assert fecha_deteccion_inicial("CHECKLIST_INCOMPLETO", None, HOY) == HOY


def test_un_incidente_sin_fecha_cuenta_desde_hoy():
    assert fecha_deteccion_inicial("PLAGAS", None, HOY) == HOY


def test_nunca_es_posterior_a_hoy():
    assert fecha_deteccion_inicial("DOCUMENTO_VENCIDO", HOY, HOY) == HOY
    assert fecha_deteccion_inicial("PLAGAS", HOY, HOY) == HOY
    assert fecha_deteccion_inicial("PLAGAS", date(2026, 12, 1), HOY) == HOY


# ---------------------------------------------------------------------------
# Qué incidentes generan riesgo
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "tipo, esperado",
    [
        ("higiene_contaminacion", "HIGIENE_CONTAMINACION"),
        ("falla_equipo", "FALLA_EQUIPO"),
        ("plagas", "PLAGAS"),
        ("otro", "OTROS"),
    ],
)
def test_los_incidentes_de_higiene_equipos_plagas_y_otros_generan_riesgo(tipo, esperado):
    assert tipo_situacion_de_incidente(tipo) == esperado
    # La causa no los afecta: ya son de riesgo por sí mismos.
    assert tipo_situacion_de_incidente(tipo, "otro") == esperado


def test_las_devoluciones_de_cliente_no_generan_riesgo():
    assert tipo_situacion_de_incidente("devolucion_cliente") is None
    assert tipo_situacion_de_incidente("devolucion_cliente", "cuerpo_extrano") is None


@pytest.mark.parametrize("tipo", ["reclamo_cliente", "retiro_lote", "entrega_rechazada"])
def test_reclamos_retiros_y_rechazos_no_generan_riesgo_por_si_mismos(tipo):
    assert tipo_situacion_de_incidente(tipo) is None
    assert tipo_situacion_de_incidente(tipo, None) is None
    assert tipo_situacion_de_incidente(tipo, "otro") is None


def test_un_reclamo_por_cuerpo_extrano_cuenta_como_contaminacion():
    assert tipo_situacion_de_incidente("reclamo_cliente", "cuerpo_extrano") == "HIGIENE_CONTAMINACION"
    assert tipo_situacion_de_incidente("reclamo_cliente", "envase_danado") is None


def test_un_retiro_por_contaminacion_cuenta_como_contaminacion():
    assert (
        tipo_situacion_de_incidente("retiro_lote", "Contaminación o cuerpo extraño")
        == "HIGIENE_CONTAMINACION"
    )
    assert tipo_situacion_de_incidente("retiro_lote", "Error de rotulado o alérgenos") is None


def test_la_causa_de_un_tipo_no_vale_para_otro():
    # "cuerpo_extrano" es un motivo de reclamo, no de retiro.
    assert tipo_situacion_de_incidente("retiro_lote", "cuerpo_extrano") is None


def test_los_valores_usados_existen_en_los_circuitos_de_origen():
    """Si alguien renombra un tipo o un motivo, esto avisa."""
    from src.incidente.constants import TipoIncidente
    from src.reclamos.constants import MOTIVOS_RECLAMO
    from src.retiros.constants import MOTIVOS_RETIRO
    from src.salidas.constants import MOTIVOS_RECHAZO

    tipos = {t.value for t in TipoIncidente}
    assert set(riesgo.TIPO_SITUACION_POR_INCIDENTE) <= tipos
    assert set(riesgo.CAUSAS_DE_CONTAMINACION) <= tipos
    assert riesgo.CAUSAS_DE_CONTAMINACION["reclamo_cliente"] <= set(MOTIVOS_RECLAMO)
    assert riesgo.CAUSAS_DE_CONTAMINACION["retiro_lote"] <= set(MOTIVOS_RETIRO)
    assert riesgo.CAUSAS_DE_CONTAMINACION["entrega_rechazada"] <= set(MOTIVOS_RECHAZO)
