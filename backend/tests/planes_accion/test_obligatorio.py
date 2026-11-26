"""Plan de acción obligatorio: qué lo exige, qué lo cumple y qué bloquea.

- El motor señala las situaciones que necesitan plan: las de un tipo que lo
  exige (lo decide el administrador) y las de un elemento en riesgo alto.
- Un plan activo o uno verificado cumplen; tratar solo lo leve de un elemento
  alto no alcanza.
- Un incidente que exige plan no se cierra sin él.
"""

from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from src.exceptions import BadRequest
from src.notificaciones import criticidad, impacto
from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo
from src.notificaciones.schemas import AlertaCriticidadResponse, ImpactoSituacionUpdate
from src.personal.models import Personal
from src.planes_accion import obligacion
from src.planes_accion.models import PlanAccion, SituacionPlan

HOY = date(2026, 11, 23)


def _alerta(clave, elemento, puntaje, *, exige=False, plan_activo=None, controlada=None):
    return AlertaCriticidadResponse(
        clave=clave, origen="INCIDENTE", entidad_id=1, grupo_clave=elemento,
        icono="incidente", titulo=clave, detalle=clave, criticidad="media",
        motivo="x", plazo="", destino="/", impacto=3, puntaje=puntaje,
        exige_plan=exige, plan_activo_id=plan_activo, plan_tratamiento_id=controlada,
    )


# --- Qué exige plan (motor) ---------------------------------------------------

def test_un_elemento_alto_exige_plan_aunque_ninguna_situacion_sea_alta():
    # 6,0 + 6,0 → 7,8: el elemento es alto, cada situación es media.
    tablero = criticidad._armar_dashboard(
        [_alerta("a", "equipo:1", 6.0), _alerta("b", "equipo:1", 6.0)]
    )
    assert {a.clave: a.motivo_plan for a in tablero.alertas} == {"a": "elemento", "b": "elemento"}
    (elemento,) = tablero.elementos
    assert elemento.nivel == "alto" and elemento.requiere_plan
    assert tablero.planes_requeridos == 2 and tablero.elementos_alto_sin_plan == 1


def test_cubrir_lo_suficiente_baja_la_obligacion_del_elemento():
    # Con "a" en un plan, lo que queda sin plan es 6,0 (medio): ya alcanza.
    tablero = criticidad._armar_dashboard(
        [_alerta("a", "equipo:1", 6.0, plan_activo=4), _alerta("b", "equipo:1", 6.0)]
    )
    assert all(a.motivo_plan is None for a in tablero.alertas)
    assert not tablero.elementos[0].requiere_plan
    assert tablero.elementos[0].puntaje_sin_plan == 6.0


def test_tratar_solo_lo_leve_de_un_elemento_alto_no_alcanza():
    tablero = criticidad._armar_dashboard(
        [
            _alerta("grave", "equipo:1", 7.2),
            _alerta("leve", "equipo:1", 1.0, plan_activo=4),
        ]
    )
    motivos = {a.clave: a.motivo_plan for a in tablero.alertas}
    assert motivos == {"grave": "elemento", "leve": None}


def test_un_tipo_obligatorio_exige_plan_desde_la_primera_deteccion():
    tablero = criticidad._armar_dashboard([_alerta("retiro", "producto:1", 3.0, exige=True)])
    assert tablero.alertas[0].motivo_plan == "tipo"
    assert tablero.alertas[0].requiere_plan
    assert not tablero.elementos[0].requiere_plan  # el elemento no es alto


def test_un_plan_verificado_tambien_cumple():
    tablero = criticidad._armar_dashboard(
        [_alerta("retiro", "producto:1", 7.2, exige=True, controlada=9)]
    )
    assert tablero.alertas[0].motivo_plan is None


def test_lo_que_no_genera_riesgo_nunca_exige_plan():
    tablero = criticidad._armar_dashboard([_alerta("aviso", "producto:1", 0.0, exige=True)])
    assert tablero.alertas[0].motivo_plan is None and tablero.planes_requeridos == 0


# --- Configuración del administrador -----------------------------------------

def test_el_administrador_apaga_un_tipo_marca_plan_obligatorio_y_elige_causas(db_session):
    impacto.fijar_impacto(db_session, "STOCK_BAJO", ImpactoSituacionUpdate(activo=False))
    impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=True))
    impacto.fijar_impacto(
        db_session, "RECLAMO_CLIENTE", ImpactoSituacionUpdate(causas=["envase_danado"])
    )

    config = impacto.configuracion_vigente(db_session)
    assert not config["STOCK_BAJO"].activo
    assert config["PLAGAS"].plan_obligatorio
    assert config["RECLAMO_CLIENTE"].causas == frozenset({"envase_danado"})
    # Cada cambio deja el resto como estaba.
    assert config["RECLAMO_CLIENTE"].plan_obligatorio and config["RECLAMO_CLIENTE"].impacto == 3

    listado = {i.tipo: i for i in impacto.listar_impactos(db_session)}
    assert listado["STOCK_BAJO"].modificado and not listado["STOCK_BAJO"].activo
    causas = {c.valor: c.cuenta for c in listado["RECLAMO_CLIENTE"].causas}
    assert causas["envase_danado"] and not causas["cuerpo_extrano"]


def test_volver_a_lo_sugerido_borra_la_fila(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=True))
    respuesta = impacto.fijar_impacto(
        db_session, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=False)
    )
    assert not respuesta.modificado


def test_no_se_aceptan_causas_que_no_existen_ni_en_tipos_sin_causa(db_session):
    with pytest.raises(BadRequest):
        impacto.fijar_impacto(db_session, "RETIRO_LOTE", ImpactoSituacionUpdate(causas=["inventada"]))
    with pytest.raises(BadRequest):
        impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(causas=["otro"]))


def test_un_tipo_apagado_se_notifica_sin_riesgo(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(activo=False))
    config = impacto.configuracion_vigente(db_session)
    incidente = SimpleNamespace(id=1, tipo="plagas", equipo_id=None)
    assert criticidad._tipos_de_riesgo(db_session, [incidente], config) == {1: (None, None)}


# --- Cierre de incidentes -------------------------------------------------------

def _incidente(tipo="plagas", id=1):
    return SimpleNamespace(id=id, tipo=tipo, equipo_id=None)


def _situacion_abierta(db, clave="incidente-1", tipo="PLAGAS"):
    fila = SituacionRiesgo(
        tipo=tipo, clave=clave, elemento="incidente-tipo:plagas",
        detectada_en=HOY - timedelta(days=1),
    )
    db.add(fila)
    db.commit()
    return fila


def test_un_incidente_de_tipo_obligatorio_no_se_cierra_sin_plan(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=True))
    _situacion_abierta(db_session)

    with pytest.raises(BadRequest):
        obligacion.exigir_plan_al_cerrar(db_session, _incidente())


def test_con_un_plan_activo_el_incidente_se_puede_cerrar(db_session):
    impacto.fijar_impacto(db_session, "PLAGAS", ImpactoSituacionUpdate(plan_obligatorio=True))
    situacion = _situacion_abierta(db_session)
    persona = Personal(
        nombre="Ada", apellido="Admin", dni="10000001", email="ada@test.local",
        password="x", puede_administrar=True, puede_operar=True,
    )
    db_session.add(persona)
    db_session.commit()
    plan = PlanAccion(
        tipo="PLAGAS", estado="en_ejecucion", situacion_origen_id=situacion.id,
        causa="c", objetivo="o", criterio_eficacia="e", responsable_id=persona.id,
        creado_por_id=persona.id, dias_observacion=30,
    )
    plan.situaciones.append(
        SituacionPlan(situacion_id=situacion.id, estado="pendiente", es_origen=True, agregada_en=HOY)
    )
    db_session.add(plan)
    db_session.commit()

    obligacion.exigir_plan_al_cerrar(db_session, _incidente())  # no corta


def test_un_incidente_que_no_exige_plan_se_cierra_libremente(db_session):
    _situacion_abierta(db_session)
    obligacion.exigir_plan_al_cerrar(db_session, _incidente())


def test_un_incidente_de_un_elemento_alto_tampoco_se_cierra_sin_plan(db_session):
    _situacion_abierta(db_session)
    db_session.add(
        NotificacionPersistida(
            id_notificacion="incidente-1", tipo="INCIDENTE", entidad_id=1, titulo="t",
            mensaje="m", nivel="ALTA", link_destino="/", criticidad="alta", motivo="x",
            puntaje=7.2, motivo_plan="elemento",
        )
    )
    db_session.commit()

    with pytest.raises(BadRequest):
        obligacion.exigir_plan_al_cerrar(db_session, _incidente())
