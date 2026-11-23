"""Ciclo de vida del plan de acción contra una base de prueba.

El motor se simula: las situaciones se crean a mano y se "resuelven" poniendo
`resuelta_en`, que es lo que hace el motor cuando deja de detectarlas. Se
neutraliza `_motor_al_dia` porque, sin fuentes reales, recalcularía las
notificaciones y cerraría todas las situaciones de prueba.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from src.notificaciones.models import SituacionRiesgo
from src.personal.models import Personal
from src.planes_accion import schemas, services
from src.planes_accion.exceptions import Conflicto, OperacionNoPermitida
from src.exceptions import BadRequest

HOY = date(2026, 11, 23)
FUTURO = HOY + timedelta(days=10)


@pytest.fixture(autouse=True)
def motor_simulado(monkeypatch):
    monkeypatch.setattr(services, "_motor_al_dia", lambda db: None)
    monkeypatch.setattr(services, "hoy", lambda: HOY)


@pytest.fixture
def usuario(db_session):
    persona = Personal(
        nombre="Ada", apellido="Admin", dni="10000001", email="ada@test.local",
        password="x", puede_administrar=True, puede_operar=True,
    )
    db_session.add(persona)
    db_session.commit()
    return persona


def _situacion(db, clave="incidente-1", tipo="PLAGAS", elemento="equipo:1", resuelta=None):
    fila = SituacionRiesgo(
        tipo=tipo, clave=clave, elemento=elemento,
        detectada_en=HOY - timedelta(days=3), resuelta_en=resuelta,
    )
    db.add(fila)
    db.commit()
    return fila


def _datos(usuario, situacion, **extra):
    base = dict(
        situacion_origen_id=situacion.id,
        causa="Rejillas sin protección",
        objetivo="Eliminar el ingreso de plagas",
        criterio_eficacia="Sin nuevos reportes en el período",
        responsable_id=usuario.id,
        acciones=[
            schemas.AccionCrear(
                descripcion="Colocar mallas", responsable_id=usuario.id, plazo=FUTURO
            )
        ],
    )
    base.update(extra)
    return schemas.PlanCrear(**base)


def _implementado(db, usuario, situacion, **extra):
    """Plan creado, confirmado y con su única acción completada."""
    plan = services.crear_plan(db, _datos(usuario, situacion, **extra), usuario)
    services.confirmar_plan(db, plan.id, usuario)
    accion = plan.acciones[0]
    return services.completar_accion(db, plan.id, accion.id, usuario, "Mallas colocadas")


# --- Creación y alcance -----------------------------------------------------

def test_crear_deja_el_plan_en_borrador_con_la_situacion_de_origen(db_session, usuario):
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)

    assert plan.estado == "borrador"
    assert plan.tipo == "PLAGAS"
    assert [(x.situacion_id, x.es_origen, x.estado) for x in plan.situaciones] == [
        (s.id, True, "pendiente")
    ]
    assert plan.dias_observacion == services.reglas.DIAS_OBSERVACION_DEFECTO
    assert [h.evento for h in plan.historial] == ["creacion"]
    assert [r.momento for r in plan.riesgos] == ["antes"]


def test_una_situacion_solo_puede_estar_en_un_plan_activo(db_session, usuario):
    s = _situacion(db_session)
    services.crear_plan(db_session, _datos(usuario, s), usuario)
    with pytest.raises(Conflicto):
        services.crear_plan(db_session, _datos(usuario, s), usuario)


def test_no_se_puede_tratar_una_situacion_que_ya_no_esta_presente(db_session, usuario):
    s = _situacion(db_session, resuelta=HOY)
    with pytest.raises(BadRequest):
        services.crear_plan(db_session, _datos(usuario, s), usuario)


def test_sumar_situaciones_exige_confirmar_la_causa_compatible(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1", elemento="equipo:1")
    s2 = _situacion(db_session, "incidente-2", elemento="equipo:2")
    with pytest.raises(BadRequest):
        services.crear_plan(
            db_session, _datos(usuario, s1, situaciones_adicionales=[s2.id]), usuario
        )
    plan = services.crear_plan(
        db_session,
        _datos(usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True),
        usuario,
    )
    assert {x.situacion_id for x in plan.situaciones} == {s1.id, s2.id}
    assert {r.elemento for r in plan.riesgos} == {"equipo:1", "equipo:2"}


def test_no_se_suman_situaciones_de_otro_tipo(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1", tipo="PLAGAS")
    s2 = _situacion(db_session, "incidente-2", tipo="FALLA_EQUIPO", elemento="equipo:2")
    with pytest.raises(BadRequest):
        services.crear_plan(
            db_session,
            _datos(usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True),
            usuario,
        )


def test_las_candidatas_son_las_del_mismo_tipo_que_nadie_trata(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1", elemento="equipo:1")
    libre = _situacion(db_session, "incidente-2", elemento="equipo:2")
    ocupada = _situacion(db_session, "incidente-3", elemento="equipo:3")
    _situacion(db_session, "incidente-4", tipo="FALLA_EQUIPO", elemento="equipo:4")
    services.crear_plan(db_session, _datos(usuario, ocupada), usuario)
    plan = services.crear_plan(db_session, _datos(usuario, s1), usuario)

    candidatas = services.candidatas_de_plan(db_session, plan.id)
    assert [c.situacion_id for c in candidatas] == [libre.id]
    assert services.obtener_plan(db_session, plan.id).candidatas_nuevas == 1


def test_confirmar_exige_al_menos_una_accion(db_session, usuario):
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s, acciones=[]), usuario)
    with pytest.raises(BadRequest):
        services.confirmar_plan(db_session, plan.id, usuario)


def test_el_plazo_no_puede_ser_anterior_a_hoy(db_session, usuario):
    s = _situacion(db_session)
    with pytest.raises(BadRequest):
        services.crear_plan(db_session, _datos(usuario, s, plazo=HOY - timedelta(days=1)), usuario)


# --- Ejecución ----------------------------------------------------------------

def test_completar_la_ultima_accion_implementa_el_plan_sin_tocar_el_riesgo(db_session, usuario):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)

    assert plan.estado == "implementado"
    assert plan.situaciones[0].estado == "accion_implementada"
    assert plan.acciones[0].completada and plan.acciones[0].evidencias[0].tipo == "implementacion"
    assert [r.momento for r in plan.riesgos] == ["antes", "implementado"]
    # La situación sigue abierta: el plan no la resuelve, la resuelve el motor.
    assert db_session.get(SituacionRiesgo, s.id).resuelta_en is None


def test_no_se_completa_una_accion_sin_evidencia(db_session, usuario):
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    services.confirmar_plan(db_session, plan.id, usuario)
    with pytest.raises(BadRequest):
        services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "  ")


def test_no_se_completan_acciones_de_un_borrador(db_session, usuario):
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    with pytest.raises(OperacionNoPermitida):
        services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "hecho")


def test_desde_implementado_el_alcance_queda_cerrado(db_session, usuario):
    s = _situacion(db_session)
    otra = _situacion(db_session, "incidente-2", elemento="equipo:2")
    plan = _implementado(db_session, usuario, s)
    with pytest.raises(OperacionNoPermitida):
        services.agregar_situaciones(
            db_session, plan.id,
            schemas.AgregarSituaciones(situacion_ids=[otra.id], confirma_causa_compatible=True),
            usuario,
        )


# --- Verificación y observación -------------------------------------------------

def test_si_la_condicion_sigue_presente_al_verificar_queda_no_eficaz_y_cierra(db_session, usuario):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)

    plan = services.verificar_plan(db_session, plan.id, usuario)

    assert plan.situaciones[0].estado == "no_eficaz"
    assert plan.estado == "cerrado_no_eficaz"
    assert plan.fecha_cierre == HOY
    assert [r.momento for r in plan.riesgos] == ["antes", "implementado", "cierre"]
    # Quedó liberada: se puede tratar en un plan nuevo, vinculado al anterior.
    nuevo = services.crear_plan(
        db_session, _datos(usuario, s, plan_anterior_id=plan.id), usuario
    )
    assert nuevo.plan_anterior_id == plan.id
    assert services.obtener_plan(db_session, plan.id).planes_vinculados == [nuevo.id]


def test_si_el_motor_deja_de_detectarla_se_confirma_sola_y_empieza_la_observacion(
    db_session, usuario
):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)
    assert plan.estado == "implementado"

    db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)

    plan = services.obtener_plan(db_session, plan.id)
    assert plan.estado == "en_verificacion"
    assert plan.situaciones[0].estado == "corregida"
    assert plan.fecha_inicio_observacion == HOY
    assert plan.fecha_fin_observacion == HOY + timedelta(days=plan.dias_observacion)


def test_al_terminar_la_observacion_sin_repeticiones_el_plan_cierra_eficaz(db_session, usuario):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)
    db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)

    en_obs = services.obtener_plan(db_session, plan.id)
    # Un día antes del fin todavía observa.
    services.sincronizar_con_motor(db_session, en_obs.fecha_fin_observacion - timedelta(days=1))
    assert services.obtener_plan(db_session, plan.id).estado == "en_verificacion"

    services.sincronizar_con_motor(db_session, en_obs.fecha_fin_observacion)
    final = services.obtener_plan(db_session, plan.id)
    assert final.estado == "cerrado_eficaz"
    assert final.situaciones[0].estado == "eficaz"


def test_una_deteccion_nueva_en_el_elemento_durante_la_observacion_la_hace_no_eficaz(
    db_session, usuario
):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)
    db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)

    # El motor registra una situación nueva, del mismo tipo, en el mismo elemento.
    nueva = _situacion(db_session, "incidente-9", elemento="equipo:1")
    services.sincronizar_con_motor(db_session, HOY + timedelta(days=5))

    plan = services.obtener_plan(db_session, plan.id)
    assert plan.situaciones[0].estado == "no_eficaz"
    assert plan.estado == "cerrado_no_eficaz"
    # La nueva detección es una situación aparte y queda libre para otro plan.
    assert services.situaciones_disponibles(db_session)[0].situacion_id == nueva.id


def test_un_cierre_mixto_es_parcialmente_eficaz(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1", elemento="equipo:1")
    s2 = _situacion(db_session, "incidente-2", elemento="equipo:2")
    plan = _implementado(
        db_session, usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True
    )
    for s in (s1, s2):
        db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)

    _situacion(db_session, "incidente-9", elemento="equipo:2")  # reaparece solo en el 2
    fin = services.obtener_plan(db_session, plan.id).fecha_fin_observacion
    services.sincronizar_con_motor(db_session, fin)

    final = services.obtener_plan(db_session, plan.id)
    assert final.estado == "cerrado_parcial"
    estados = {x.elemento: x.estado for x in final.situaciones}
    assert estados == {"equipo:1": "eficaz", "equipo:2": "no_eficaz"}


def test_cancelar_exige_motivo_y_libera_las_situaciones(db_session, usuario):
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    with pytest.raises(Exception):
        schemas.CancelarPlan(motivo=" ")

    plan = services.cancelar_plan(db_session, plan.id, "Se resolvió por otra vía", usuario)
    assert plan.estado == "cancelado"
    assert plan.motivo_cancelacion == "Se resolvió por otra vía"
    assert services.situaciones_disponibles(db_session)[0].situacion_id == s.id


def test_en_verificacion_ya_no_se_puede_cancelar(db_session, usuario):
    s = _situacion(db_session)
    plan = _implementado(db_session, usuario, s)
    db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)
    with pytest.raises(OperacionNoPermitida):
        services.cancelar_plan(db_session, plan.id, "ya no hace falta", usuario)


def test_el_plan_vinculado_tiene_que_ser_un_plan_cerrado(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1")
    s2 = _situacion(db_session, "incidente-2", elemento="equipo:2")
    activo = services.crear_plan(db_session, _datos(usuario, s1), usuario)
    with pytest.raises(BadRequest):
        services.crear_plan(db_session, _datos(usuario, s2, plan_anterior_id=activo.id), usuario)


# --- Configuración del período de observación ---------------------------------------

def test_el_periodo_de_observacion_se_configura_por_tipo_y_se_congela_en_el_plan(
    db_session, usuario
):
    services.fijar_observacion(db_session, "PLAGAS", 60)
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    assert plan.dias_observacion == 60

    services.restablecer_observacion(db_session, "PLAGAS")
    assert services.obtener_plan(db_session, plan.id).dias_observacion == 60  # no cambia


def test_no_se_acepta_un_periodo_menor_a_la_ventana_de_recurrencia(db_session):
    with pytest.raises(BadRequest):
        services.fijar_observacion(db_session, "PLAGAS", 10)


# --- Listados -------------------------------------------------------------------------

def test_las_situaciones_con_plan_muestran_el_plan_activo(db_session, usuario):
    s = _situacion(db_session, "notificacion-elem-5", tipo="PLAGAS")
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    (fila,) = services.situaciones_con_plan(db_session)
    assert (fila.clave_alerta, fila.plan_id) == ("elem-5", plan.id)


def test_el_listado_filtra_por_grupo_y_estado(db_session, usuario):
    s1 = _situacion(db_session, "incidente-1")
    s2 = _situacion(db_session, "incidente-2", elemento="equipo:2")
    p1 = services.crear_plan(db_session, _datos(usuario, s1), usuario)
    p2 = services.crear_plan(db_session, _datos(usuario, s2), usuario)
    services.cancelar_plan(db_session, p2.id, "no corresponde", usuario)

    activos, total = services.listar_planes(db_session, grupo="activos")
    assert [p.id for p in activos] == [p1.id] and total == 1
    finalizados, _ = services.listar_planes(db_session, grupo="finalizados")
    assert [p.id for p in finalizados] == [p2.id]
    pagina, total = services.listar_planes(db_session, page=1, page_size=1)
    assert len(pagina) == 1 and total == 2
