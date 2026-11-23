"""Tests del historial de situaciones, la evaluación y el impacto configurable.

Ejercitan `_sincronizar_situaciones` y `_evaluar_alertas` con alertas armadas a
mano (no hace falta crear equipos ni incidentes): lo que se prueba es cuándo
nace, persiste y se resuelve un evento de riesgo, y cómo se mide.

Generan riesgo los incidentes (higiene y contaminación, falla de equipo, plagas,
otros), el stock por debajo del mínimo, los checklists incumplidos y los
vencimientos. Las alertas de estos tests son, salvo que se diga otra cosa,
incidentes.
"""

from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from src.exceptions import NotFound
from src.notificaciones import criticidad, impacto, riesgo
from src.notificaciones.models import ConfiguracionImpacto, SituacionRiesgo

HOY = date(2026, 11, 18)
VENTANA = timedelta(days=riesgo.DIAS_VENTANA_RECURRENCIA)


def _alerta(
    regla="PLAGAS",
    clave="incidente-1",
    grupo="equipo:1",
    fecha=HOY,
):
    return {"regla": regla, "clave": clave, "grupo_clave": grupo, "fecha_referencia": fecha}


def _sincronizar(db, alertas, hoy=HOY):
    vigentes = criticidad._sincronizar_situaciones(
        db, alertas, hoy_dia=hoy, desde=hoy - VENTANA
    )
    db.commit()
    return vigentes


def _evaluar(db, alertas, vigentes, hoy=HOY):
    criticidad._evaluar_alertas(db, alertas, vigentes, hoy_dia=hoy, desde=hoy - VENTANA)


def _filas(db):
    return list(db.scalars(select(SituacionRiesgo).order_by(SituacionRiesgo.id)))


def _historial(db, *, tipo="PLAGAS", elemento="equipo:1", clave, detectada, resuelta):
    db.add(
        SituacionRiesgo(
            tipo=tipo, clave=clave, elemento=elemento,
            detectada_en=detectada, resuelta_en=resuelta,
        )
    )
    db.commit()


def _antes(dias):
    return HOY - timedelta(days=dias)


# ---------------------------------------------------------------------------
# Nacimiento, persistencia y resolución
# ---------------------------------------------------------------------------

def test_un_evento_nuevo_queda_registrado(db_session):
    _sincronizar(db_session, [_alerta()])

    (fila,) = _filas(db_session)
    assert (fila.tipo, fila.clave, fila.elemento) == ("PLAGAS", "incidente-1", "equipo:1")
    assert fila.resuelta_en is None


def test_un_incidente_cuenta_desde_el_dia_en_que_se_reporto(db_session):
    _sincronizar(db_session, [_alerta(fecha=_antes(8))])
    assert _filas(db_session)[0].detectada_en == _antes(8)


def test_seguir_presente_no_crea_otro_evento(db_session):
    _sincronizar(db_session, [_alerta(fecha=_antes(3))])
    _sincronizar(db_session, [_alerta(fecha=_antes(3))], hoy=HOY + timedelta(days=1))
    _sincronizar(db_session, [_alerta(fecha=_antes(3))], hoy=HOY + timedelta(days=2))

    (fila,) = _filas(db_session)
    assert fila.detectada_en == _antes(3)
    assert fila.resuelta_en is None


def test_al_dejar_de_detectarse_se_resuelve_y_queda_en_el_historial(db_session):
    _sincronizar(db_session, [_alerta()])
    dia = HOY + timedelta(days=1)
    _sincronizar(db_session, [], hoy=dia)

    (fila,) = _filas(db_session)
    assert fila.resuelta_en == dia


def test_si_vuelve_despues_es_un_evento_nuevo_que_cuenta_desde_hoy(db_session):
    _sincronizar(db_session, [_alerta(fecha=_antes(5))])
    _sincronizar(db_session, [], hoy=HOY + timedelta(days=1))
    vuelve = HOY + timedelta(days=3)
    _sincronizar(db_session, [_alerta(fecha=_antes(5))], hoy=vuelve)

    primera, segunda = _filas(db_session)
    assert primera.resuelta_en == HOY + timedelta(days=1)  # el historial no se toca
    assert segunda.detectada_en == vuelve  # un incidente reabierto cuenta desde que reabre
    assert segunda.resuelta_en is None


def test_resolverse_y_volver_el_mismo_dia_es_un_solo_evento(db_session):
    _sincronizar(db_session, [_alerta(fecha=_antes(5))])
    _sincronizar(db_session, [])
    _sincronizar(db_session, [_alerta(fecha=_antes(5))])

    (fila,) = _filas(db_session)
    assert fila.resuelta_en is None
    assert fila.detectada_en == _antes(5)


def test_lo_vencido_cuenta_desde_el_dia_siguiente_al_vencimiento(db_session):
    _sincronizar(
        db_session,
        [_alerta(regla="DOCUMENTO_VENCIDO", clave="documento-1", grupo="documento:1", fecha=date(2026, 11, 10))],
    )
    assert _filas(db_session)[0].detectada_en == date(2026, 11, 11)


def test_lo_proximo_a_vencer_cuenta_desde_hoy(db_session):
    _sincronizar(
        db_session,
        [_alerta(regla="DOCUMENTO_PROXIMO", clave="documento-1", grupo="documento:1", fecha=date(2026, 11, 25))],
    )
    assert _filas(db_session)[0].detectada_en == HOY


def test_cambiar_de_proximo_a_vencido_es_otro_tipo_de_evento(db_session):
    _sincronizar(db_session, [_alerta(regla="DOCUMENTO_PROXIMO", clave="documento-1", grupo="documento:1", fecha=date(2026, 11, 20))])
    dia = date(2026, 11, 22)
    _sincronizar(db_session, [_alerta(regla="DOCUMENTO_VENCIDO", clave="documento-1", grupo="documento:1", fecha=date(2026, 11, 20))], hoy=dia)

    proxima, vencida = _filas(db_session)
    assert proxima.tipo == "DOCUMENTO_PROXIMO" and proxima.resuelta_en == dia
    assert vencida.tipo == "DOCUMENTO_VENCIDO" and vencida.resuelta_en is None


def test_stock_y_checklist_cuentan_desde_hoy(db_session):
    _sincronizar(
        db_session,
        [
            _alerta(regla="STOCK_BAJO", clave="notificacion-stock-3", grupo="insumo:3", fecha=_antes(20)),
            _alerta(regla="CHECKLIST_INCOMPLETO", clave="checklist-equipo-1-x", grupo="equipo:1", fecha=HOY),
        ],
    )
    assert [f.detectada_en for f in _filas(db_session)] == [HOY, HOY]


def test_dos_incidentes_distintos_de_la_misma_clase_son_dos_eventos(db_session):
    _sincronizar(
        db_session,
        [_alerta(clave="incidente-1"), _alerta(clave="incidente-2")],
    )
    assert len(_filas(db_session)) == 2


# ---------------------------------------------------------------------------
# Evaluación: persistencia y recurrencia
# ---------------------------------------------------------------------------

def test_la_persistencia_crece_mientras_sigue_presente(db_session):
    _sincronizar(db_session, [_alerta()])

    for dias, esperado in [(0, 1), (2, 1), (3, 2), (7, 2), (8, 3)]:
        dia = HOY + timedelta(days=dias)
        alertas = [_alerta()]
        vigentes = _sincronizar(db_session, alertas, hoy=dia)
        _evaluar(db_session, alertas, vigentes, hoy=dia)
        assert alertas[0]["persistencia"] == esperado, f"a los {dias} días"


def test_la_persistencia_deja_de_acumularse_al_resolverse(db_session):
    _sincronizar(db_session, [_alerta()])
    _sincronizar(db_session, [], hoy=HOY + timedelta(days=1))

    (fila,) = _filas(db_session)
    assert (fila.resuelta_en - fila.detectada_en).days == 1


def test_la_recurrencia_cuenta_las_ya_resueltas_dentro_de_la_ventana(db_session):
    # Cinco veces anteriores de la misma clase en el mismo elemento, ya resueltas...
    for atras in (25, 21, 17, 13, 9):
        _historial(db_session, clave=f"incidente-{atras}", detectada=_antes(atras), resuelta=_antes(atras - 2))

    # ... y ahora una sexta.
    alertas = [_alerta(clave="incidente-100")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 3  # 6 detecciones, incluida la actual


def test_con_una_deteccion_anterior_la_recurrencia_sigue_baja(db_session):
    # Una vez anterior + la actual = 2 detecciones → puntaje 1.
    _historial(db_session, clave="incidente-50", detectada=_antes(10), resuelta=_antes(5))

    alertas = [_alerta(clave="incidente-100")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 1


def test_con_pocas_detecciones_la_recurrencia_es_media(db_session):
    # Dos veces anteriores + la actual = 3 detecciones → puntaje 2.
    _historial(db_session, clave="incidente-50", detectada=_antes(20), resuelta=_antes(15))
    _historial(db_session, clave="incidente-51", detectada=_antes(10), resuelta=_antes(5))

    alertas = [_alerta(clave="incidente-100")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 2


def test_lo_que_salio_de_la_ventana_ya_no_cuenta(db_session):
    _historial(db_session, clave="incidente-50", detectada=HOY - VENTANA - timedelta(days=10), resuelta=HOY - VENTANA - timedelta(days=5))
    _historial(db_session, clave="incidente-51", detectada=HOY - VENTANA - timedelta(days=4), resuelta=HOY - VENTANA - timedelta(days=2))
    _historial(db_session, clave="incidente-52", detectada=HOY - VENTANA - timedelta(days=3), resuelta=HOY - VENTANA - timedelta(days=1))

    alertas = [_alerta(clave="incidente-100")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 1


def test_la_recurrencia_es_por_clase_y_por_elemento(db_session):
    # Mismo elemento, OTRA clase; misma clase, OTRO elemento: ninguna cuenta.
    for n in range(3):
        _historial(db_session, tipo="FALLA_EQUIPO", clave=f"incidente-{10 + n}", detectada=_antes(9 - n), resuelta=_antes(8 - n))
        _historial(db_session, elemento="equipo:2", clave=f"incidente-{20 + n}", detectada=_antes(9 - n), resuelta=_antes(8 - n))

    alertas = [_alerta(clave="incidente-100")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 1


def test_un_evento_que_empezo_antes_de_la_ventana_igual_cuenta_como_actual(db_session):
    alertas = [_alerta(clave="incidente-9", fecha=_antes(90))]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["recurrencia"] == 1
    assert alertas[0]["persistencia"] == 3  # lleva 90 días presente


def test_el_puntaje_sale_de_impacto_por_probabilidad(db_session):
    _historial(db_session, clave="incidente-1", detectada=_antes(20), resuelta=_antes(17))
    _historial(db_session, clave="incidente-3", detectada=_antes(12), resuelta=_antes(9))

    # Incidente nuevo, reportado hoy: recurrencia 2 (1,4) + persistencia 1 (0,3) = 1,7
    alertas = [_alerta(clave="incidente-2")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    a = alertas[0]
    assert a["impacto"] == 3  # impacto alto sugerido
    assert a["probabilidad"] == 1.7
    assert a["puntaje"] == 5.1
    assert a["criticidad"] == "media"
    assert "= 5,1" in a["motivo"]


# ---------------------------------------------------------------------------
# Qué incidentes generan riesgo
# ---------------------------------------------------------------------------

def _incidente_cerrado(id, tipo, equipo_id=None):
    return SimpleNamespace(
        id=id,
        tipo=tipo,
        estado="cerrado",
        equipo_id=equipo_id,
        fecha_reporte=datetime(2026, 11, 1, 9, 0),
        fecha_cierre=datetime(2026, 11, 3, 9, 0),
    )


def test_los_tipos_de_riesgo_salen_del_tipo_de_incidente_y_de_la_causa(db_session):
    incidentes = [
        _incidente_cerrado(1, "plagas"),
        _incidente_cerrado(2, "falla_equipo"),
        _incidente_cerrado(3, "higiene_contaminacion"),
        _incidente_cerrado(4, "otro"),
        _incidente_cerrado(5, "devolucion_cliente"),  # no está entre las clases de riesgo
        # De sistema, sin su reclamo/retiro/rechazo de origen: no hay causa.
        _incidente_cerrado(6, "reclamo_cliente"),
        _incidente_cerrado(7, "retiro_lote"),
        _incidente_cerrado(8, "entrega_rechazada"),
    ]

    assert criticidad._tipos_de_riesgo(db_session, incidentes) == {
        1: "PLAGAS",
        2: "FALLA_EQUIPO",
        3: "HIGIENE_CONTAMINACION",
        4: "OTROS",
        5: None,
        6: None,
        7: None,
        8: None,
    }


def _checklist(equipo_id, fecha, completado):
    return SimpleNamespace(
        equipo_id=equipo_id,
        fecha=fecha,
        registros=[SimpleNamespace(completado=completado)],
    )


def test_el_historial_inicial_solo_siembra_incidentes_de_riesgo(db_session):
    incidentes = [
        _incidente_cerrado(1, "plagas", equipo_id=4),
        _incidente_cerrado(2, "devolucion_cliente"),
        _incidente_cerrado(3, "higiene_contaminacion"),
    ]
    criticidad._sembrar_historial(
        db_session,
        incidentes=incidentes,
        tipos_riesgo={1: "PLAGAS", 2: None, 3: "HIGIENE_CONTAMINACION"},
        checklists=[],
        hoy_dia=HOY,
        desde=HOY - VENTANA,
    )
    db_session.commit()

    assert [(f.clave, f.tipo, f.elemento) for f in _filas(db_session)] == [
        ("incidente-1", "PLAGAS", "equipo:4"),
        ("incidente-3", "HIGIENE_CONTAMINACION", "incidente-tipo:higiene_contaminacion"),
    ]


def test_el_historial_inicial_siembra_los_checklists_incumplidos_pasados(db_session):
    criticidad._sembrar_historial(
        db_session,
        incidentes=[],
        tipos_riesgo={},
        checklists=[
            _checklist(7, _antes(3), completado=False),  # incumplido: cuenta
            _checklist(7, _antes(2), completado=True),  # cumplido: no
            _checklist(7, HOY, completado=False),  # hoy lo detecta el motor
        ],
        hoy_dia=HOY,
        desde=HOY - VENTANA,
    )
    db_session.commit()

    (fila,) = _filas(db_session)
    assert (fila.tipo, fila.elemento, fila.detectada_en) == ("CHECKLIST_INCOMPLETO", "equipo:7", _antes(3))
    assert fila.resuelta_en == _antes(2)


# ---------------------------------------------------------------------------
# Lo que se notifica pero no genera riesgo
# ---------------------------------------------------------------------------

def _respuesta(alerta):
    from src.notificaciones.schemas import AlertaCriticidadResponse

    return AlertaCriticidadResponse(
        clave=alerta["clave"],
        origen=alerta["origen"],
        entidad_id=alerta["entidad_id"],
        grupo_clave=alerta["grupo_clave"],
        icono=alerta["icono"],
        titulo=alerta["titulo"],
        detalle=alerta["detalle"],
        criticidad=alerta["criticidad"],
        motivo=alerta["motivo"],
        plazo=alerta["plazo"],
        fecha_referencia=alerta["fecha_referencia"],
        destino=alerta["destino"],
        impacto=alerta["impacto"],
        recurrencia=alerta["recurrencia"],
        persistencia=alerta["persistencia"],
        probabilidad=alerta["probabilidad"],
        puntaje=alerta["puntaje"],
        detectada_en=alerta["detectada_en"],
    )


def _incidente(id, genera_riesgo):
    """Un incidente de plagas (genera riesgo) o uno de otra clase que solo se notifica."""
    return criticidad._crear_alerta(
        clave=f"incidente-{id}",
        origen="INCIDENTE",
        entidad_id=id,
        grupo_clave="equipo:1",
        titulo=f"Incidente {id}",
        detalle="detalle",
        regla="PLAGAS" if genera_riesgo else "INCIDENTE_ABIERTO",
        fecha_referencia=HOY - timedelta(days=2),
        destino=f"/incidentes/{id}",
    )


@pytest.mark.parametrize(
    "regla, origen, genera",
    [
        ("INCIDENTE_ABIERTO", "INCIDENTE", False),
        ("DOCUMENTO_VENCIDO", "DOCUMENTO", True),
        ("VENCIMIENTO_PERSONAL_PROXIMO", "VENCIMIENTO_PERSONAL", True),
        ("PLAN_CALIBRACION_VENCIDO", "PLAN_CALIBRACION", True),
        ("ELEMENTO_LIMPIEZA_PROXIMO", "ELEMENTO_LIMPIEZA", True),
        ("PLAGAS", "INCIDENTE", True),
        ("OTROS", "INCIDENTE", True),
        ("STOCK_BAJO", "STOCK_BAJO", True),
        ("CHECKLIST_INCOMPLETO", "CHECKLIST", True),
    ],
)
def test_que_alertas_generan_riesgo(regla, origen, genera):
    alerta = criticidad._crear_alerta(
        clave="x-1",
        origen=origen,
        entidad_id=1,
        grupo_clave="x:1",
        titulo="t",
        detalle="d",
        regla=regla,
        fecha_referencia=HOY,
        destino="/x",
    )
    assert alerta["genera_riesgo"] is genera


def test_una_alerta_sin_riesgo_se_notifica_con_puntaje_cero():
    alerta = _incidente(5, genera_riesgo=False)
    criticidad._marcar_sin_riesgo(alerta, HOY)

    assert alerta["puntaje"] == 0.0
    assert alerta["impacto"] == alerta["recurrencia"] == alerta["persistencia"] == 0
    assert alerta["probabilidad"] == 0.0
    assert "no se incluye en el cálculo de riesgo" in alerta["motivo"]


def test_lo_que_no_genera_riesgo_no_suma_al_elemento_ni_a_los_contadores(db_session):
    con_riesgo = [_incidente(1, genera_riesgo=True)]
    vigentes = _sincronizar(db_session, con_riesgo)
    _evaluar(db_session, con_riesgo, vigentes)
    sin_riesgo = _incidente(2, genera_riesgo=False)
    criticidad._marcar_sin_riesgo(sin_riesgo, HOY)

    solo = criticidad._armar_dashboard([_respuesta(a) for a in con_riesgo])
    con_ambos = criticidad._armar_dashboard([_respuesta(a) for a in con_riesgo + [sin_riesgo]])

    # Aparece entre las alertas...
    assert con_ambos.total == 2
    assert {a.clave for a in con_ambos.alertas} == {"incidente-1", "incidente-2"}
    # ... pero el riesgo del elemento y los contadores son los mismos.
    assert con_ambos.elementos == solo.elementos
    assert con_ambos.puntaje_maximo == solo.puntaje_maximo
    assert (con_ambos.altas, con_ambos.medias, con_ambos.bajas) == (solo.altas, solo.medias, solo.bajas)
    assert all(a.puntaje_elemento == 0.0 for a in con_ambos.alertas if a.clave == "incidente-2")


def test_un_elemento_con_solo_alertas_sin_riesgo_queda_sin_riesgo():
    sin_riesgo = _incidente(2, genera_riesgo=False)
    criticidad._marcar_sin_riesgo(sin_riesgo, HOY)

    dashboard = criticidad._armar_dashboard([_respuesta(sin_riesgo)])

    assert dashboard.total == 1
    assert dashboard.elementos == []
    assert dashboard.nivel_riesgo == "sin_riesgo"
    assert dashboard.puntaje_maximo == 0.0


# ---------------------------------------------------------------------------
# Impacto configurable por el administrador
# ---------------------------------------------------------------------------

def test_sin_configurar_se_usa_el_impacto_sugerido(db_session):
    vigentes = impacto.impactos_vigentes(db_session)
    assert vigentes == {
        "HIGIENE_CONTAMINACION": 3,
        "FALLA_EQUIPO": 3,
        "PLAGAS": 3,
        "STOCK_BAJO": 2,
        "CHECKLIST_INCOMPLETO": 1,
        "OTROS": 3,
        "DOCUMENTO_VENCIDO": 2,
        "DOCUMENTO_PROXIMO": 1,
        "VENCIMIENTO_PERSONAL_VENCIDO": 2,
        "VENCIMIENTO_PERSONAL_PROXIMO": 1,
        "PLAN_CALIBRACION_VENCIDO": 2,
        "PLAN_CALIBRACION_PROXIMO": 1,
        "PLAN_MANTENIMIENTO_VENCIDO": 2,
        "PLAN_MANTENIMIENTO_PROXIMO": 1,
        "ELEMENTO_LIMPIEZA_VENCIDO": 2,
        "ELEMENTO_LIMPIEZA_PROXIMO": 1,
    }


def test_el_administrador_puede_cambiar_el_impacto_de_un_tipo(db_session):
    respuesta = impacto.fijar_impacto(db_session, "FALLA_EQUIPO", 2)

    assert respuesta.impacto == 2
    assert respuesta.impacto_sugerido == 3
    assert respuesta.modificado is True
    assert impacto.impactos_vigentes(db_session)["FALLA_EQUIPO"] == 2


def test_el_impacto_configurado_cambia_el_puntaje(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", 1)

    alertas = [_alerta(regla="PLAGAS")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert alertas[0]["impacto"] == 1
    assert alertas[0]["puntaje"] == 1.0  # 1 × (0,7 × 1 + 0,3 × 1)


def test_fijar_el_mismo_tipo_dos_veces_actualiza_no_duplica(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", 1)
    impacto.fijar_impacto(db_session, "PLAGAS", 2)

    filas = list(db_session.scalars(select(ConfiguracionImpacto)))
    assert [(f.tipo, f.impacto) for f in filas] == [("PLAGAS", 2)]


def test_restaurar_vuelve_al_valor_sugerido(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", 1)
    respuesta = impacto.restaurar_impacto(db_session, "PLAGAS")

    assert respuesta.impacto == 3
    assert respuesta.modificado is False
    assert db_session.get(ConfiguracionImpacto, {"establecimiento_id": 1, "tipo": "PLAGAS"}) is None


def test_un_tipo_inexistente_es_404(db_session):
    with pytest.raises(NotFound):
        impacto.fijar_impacto(db_session, "NO_EXISTE", 2)
    with pytest.raises(NotFound):
        impacto.restaurar_impacto(db_session, "NO_EXISTE")


def test_la_categoria_otros_tiene_impacto_personalizable(db_session):
    respuesta = impacto.fijar_impacto(db_session, "OTROS", 1)
    assert (respuesta.etiqueta, respuesta.impacto, respuesta.modificado) == ("Otros", 1, True)

    alertas = [_alerta(regla="OTROS", clave="incidente-8")]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)
    assert alertas[0]["impacto"] == 1
    assert alertas[0]["puntaje"] == 1.0


def test_un_vencimiento_se_evalua_con_su_impacto(db_session):
    alertas = [
        # Venció ayer: presente desde hoy, así que la persistencia es 1.
        _alerta(regla="DOCUMENTO_VENCIDO", clave="documento-1", grupo="documento:1", fecha=_antes(1)),
        _alerta(regla="DOCUMENTO_PROXIMO", clave="documento-2", grupo="documento:2", fecha=date(2026, 11, 25)),
    ]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    # Vencido: impacto 2 × (0,7 × 1 + 0,3 × 1); próximo: impacto 1.
    assert [(a["impacto"], a["puntaje"]) for a in alertas] == [(2, 2.0), (1, 1.0)]


def test_stock_y_checklist_se_evaluan_con_su_impacto(db_session):
    alertas = [
        _alerta(regla="STOCK_BAJO", clave="notificacion-stock-3", grupo="insumo:3"),
        _alerta(regla="CHECKLIST_INCOMPLETO", clave="checklist-equipo-1-x", grupo="equipo:1"),
    ]
    vigentes = _sincronizar(db_session, alertas)
    _evaluar(db_session, alertas, vigentes)

    assert [(a["impacto"], a["puntaje"]) for a in alertas] == [(2, 2.0), (1, 1.0)]
    assert [a["criticidad"] for a in alertas] == ["baja", "baja"]


def test_lo_que_no_genera_riesgo_no_tiene_impacto_configurable(db_session):
    for tipo in ("INCIDENTE_ABIERTO", "TIPO_INEXISTENTE"):
        with pytest.raises(NotFound):
            impacto.fijar_impacto(db_session, tipo, 2)


def test_un_valor_invalido_guardado_no_tumba_al_motor(db_session):
    db_session.info["sin_auditoria"] = True
    try:
        db_session.add(ConfiguracionImpacto(tipo="PLAGAS", impacto=9))
        db_session.add(ConfiguracionImpacto(tipo="TIPO_VIEJO", impacto=2))  # de una versión anterior
        db_session.commit()
    finally:
        db_session.info.pop("sin_auditoria", None)

    vigentes = impacto.impactos_vigentes(db_session)
    assert vigentes["PLAGAS"] == 3  # ignora el 9 y usa el sugerido
    assert "TIPO_VIEJO" not in vigentes


def test_el_listado_trae_los_tipos_de_riesgo_con_su_estado(db_session):
    impacto.fijar_impacto(db_session, "FALLA_EQUIPO", 2)

    lista = impacto.listar_impactos(db_session)

    assert [i.tipo for i in lista] == list(riesgo.TIPOS_SITUACION)
    por_tipo = {i.tipo: i for i in lista}
    assert por_tipo["FALLA_EQUIPO"].modificado is True
    assert por_tipo["PLAGAS"].modificado is False
