"""Ciclo de vida del plan de acción contra una base de prueba.

El motor se simula: las situaciones se crean a mano y se "resuelven" poniendo
`resuelta_en`, que es lo que hace el motor cuando deja de detectarlas. Se
neutraliza `_motor_al_dia` porque, sin fuentes reales, recalcularía las
notificaciones y cerraría todas las situaciones de prueba.
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo
from src.personal.models import Personal
from src.planes_accion import mitigacion, schemas, services
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


@pytest.fixture
def verificador(db_session):
    """Otra persona: quien verifica a mano no puede ser quien ejecutó el plan."""
    persona = Personal(
        nombre="Bruno", apellido="Calidad", dni="10000002", email="bruno@test.local",
        password="x", puede_administrar=False, puede_operar=True,
    )
    db_session.add(persona)
    db_session.commit()
    return persona


def _situacion(db, clave="calib-1", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1", resuelta=None):
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
    assert plan.tipo == "PLAN_CALIBRACION_VENCIDO"
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
    s1 = _situacion(db_session, "calib-1", elemento="equipo:1")
    s2 = _situacion(db_session, "calib-2", elemento="equipo:2")
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
    s1 = _situacion(db_session, "calib-1", tipo="PLAGAS")
    s2 = _situacion(db_session, "calib-2", tipo="FALLA_EQUIPO", elemento="equipo:2")
    with pytest.raises(BadRequest):
        services.crear_plan(
            db_session,
            _datos(usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True),
            usuario,
        )


def test_las_candidatas_son_las_del_mismo_tipo_que_nadie_trata(db_session, usuario):
    s1 = _situacion(db_session, "calib-1", elemento="equipo:1")
    libre = _situacion(db_session, "calib-2", elemento="equipo:2")
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
    otra = _situacion(db_session, "calib-2", elemento="equipo:2")
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
    nueva = _situacion(db_session, "calib-9", elemento="equipo:1")
    services.sincronizar_con_motor(db_session, HOY + timedelta(days=5))

    plan = services.obtener_plan(db_session, plan.id)
    assert plan.situaciones[0].estado == "no_eficaz"
    assert plan.estado == "cerrado_no_eficaz"
    # La nueva detección es una situación aparte y queda libre para otro plan.
    assert services.situaciones_disponibles(db_session)[0].situacion_id == nueva.id


def test_un_cierre_mixto_es_parcialmente_eficaz(db_session, usuario):
    s1 = _situacion(db_session, "calib-1", elemento="equipo:1")
    s2 = _situacion(db_session, "calib-2", elemento="equipo:2")
    plan = _implementado(
        db_session, usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True
    )
    for s in (s1, s2):
        db_session.get(SituacionRiesgo, s.id).resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)

    _situacion(db_session, "calib-9", elemento="equipo:2")  # reaparece solo en el 2
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
    s1 = _situacion(db_session, "calib-1")
    s2 = _situacion(db_session, "calib-2", elemento="equipo:2")
    activo = services.crear_plan(db_session, _datos(usuario, s1), usuario)
    with pytest.raises(BadRequest):
        services.crear_plan(db_session, _datos(usuario, s2, plan_anterior_id=activo.id), usuario)


# --- Configuración del período de observación ---------------------------------------

def test_el_periodo_de_observacion_se_configura_por_tipo_y_se_congela_en_el_plan(
    db_session, usuario
):
    services.fijar_observacion(db_session, "PLAN_CALIBRACION_VENCIDO", 60)
    s = _situacion(db_session)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    assert plan.dias_observacion == 60

    services.restablecer_observacion(db_session, "PLAN_CALIBRACION_VENCIDO")
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
    s1 = _situacion(db_session, "calib-1")
    s2 = _situacion(db_session, "calib-2", elemento="equipo:2")
    p1 = services.crear_plan(db_session, _datos(usuario, s1), usuario)
    p2 = services.crear_plan(db_session, _datos(usuario, s2), usuario)
    services.cancelar_plan(db_session, p2.id, "no corresponde", usuario)

    activos, total = services.listar_planes(db_session, grupo="activos")
    assert [p.id for p in activos] == [p1.id] and total == 1
    finalizados, _ = services.listar_planes(db_session, grupo="finalizados")
    assert [p.id for p in finalizados] == [p2.id]
    pagina, total = services.listar_planes(db_session, page=1, page_size=1)
    assert len(pagina) == 1 and total == 2


# --- Incidentes: verificación manual y situación controlada -----------------------

def _incidente(db, clave="inc-1", elemento="equipo:1", resuelta=None):
    return _situacion(db, clave, tipo="PLAGAS", elemento=elemento, resuelta=resuelta)


def _alerta(db, clave, elemento, impacto, puntaje, recurrencia=1, plan_id=None):
    db.add(
        NotificacionPersistida(
            id_notificacion=clave, tipo="INCIDENTE", entidad_id=1, titulo=f"Evento {clave}",
            mensaje=f"Equipo {elemento}", nivel="ALTA", link_destino="/incidentes/1",
            grupo_clave=elemento, criticidad="alta", motivo="x", impacto=impacto,
            recurrencia=recurrencia, persistencia=3, probabilidad=2.0, puntaje=puntaje,
            plan_tratamiento_id=plan_id,
        )
    )
    db.commit()


def _cerrar_incidente(db, situacion):
    """Lo que hace el motor cuando alguien cierra el incidente en su ficha."""
    situacion.resuelta_en = HOY
    db.commit()


def _verificado(db, usuario, verificador, situacion):
    """Plan con un incidente implementado, cerrado y verificado a mano por otra
    persona."""
    plan = _implementado(db, usuario, situacion)
    _cerrar_incidente(db, situacion)
    return services.verificar_situacion(
        db, plan.id, plan.situaciones[0].id, verificador,
        descripcion="Mallas colocadas y revisadas en el recorrido", resultado="corregida",
    )


def test_un_incidente_no_se_verifica_solo_aunque_siga_abierto(db_session, usuario):
    plan = _implementado(db_session, usuario, _incidente(db_session))

    plan = services.verificar_plan(db_session, plan.id, usuario)

    # El incidente sigue abierto (no lo cierra el plan): espera que otra persona
    # confirme a mano que la causa está corregida.
    assert plan.estado == "implementado"
    assert plan.situaciones[0].estado == "accion_implementada"
    assert plan.situaciones[0].verificacion_manual


def test_al_verificar_a_mano_el_incidente_cerrado_empieza_la_observacion(
    db_session, usuario, verificador
):
    s = _incidente(db_session)
    plan = _verificado(db_session, usuario, verificador, s)

    assert plan.estado == "en_verificacion"
    assert plan.situaciones[0].estado == "corregida"
    # Cerrado, ya no suma riesgo: no hace falta mostrarlo como controlado.
    assert not plan.situaciones[0].sigue_presente
    assert not plan.situaciones[0].controlada
    assert plan.situaciones[0].evidencias[0].tipo == "verificacion"
    assert mitigacion.situaciones_controladas(db_session) == {s.id: plan.id}


def test_quien_ejecuto_el_plan_no_puede_verificarlo(db_session, usuario, verificador):
    plan = _implementado(db_session, usuario, _incidente(db_session))

    # Ni el responsable del plan...
    with pytest.raises(OperacionNoPermitida):
        services.verificar_situacion(
            db_session, plan.id, plan.situaciones[0].id, usuario,
            descripcion="Mallas colocadas y revisadas", resultado="corregida",
        )
    assert mitigacion.situaciones_controladas(db_session) == {}


def test_el_responsable_de_una_accion_tampoco_puede_verificar(db_session, usuario, verificador):
    s = _incidente(db_session)
    datos = _datos(usuario, s)
    datos.acciones[0].responsable_id = verificador.id
    plan = services.crear_plan(db_session, datos, usuario)
    services.confirmar_plan(db_session, plan.id, usuario)
    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, verificador, "Hecho")

    with pytest.raises(OperacionNoPermitida):
        services.verificar_situacion(
            db_session, plan.id, plan.situaciones[0].id, verificador,
            descripcion="Mallas colocadas y revisadas", resultado="corregida",
        )


def test_la_verificacion_manual_exige_evidencia_sustancial(db_session, usuario, verificador):
    plan = _implementado(db_session, usuario, _incidente(db_session))

    for texto in (None, "", "ok", "listo"):
        with pytest.raises(BadRequest):
            services.verificar_situacion(
                db_session, plan.id, plan.situaciones[0].id, verificador,
                descripcion=texto, resultado="corregida",
            )
    assert mitigacion.situaciones_controladas(db_session) == {}


def test_un_incidente_abierto_no_se_puede_dar_por_corregido(db_session, usuario, verificador):
    s = _incidente(db_session)
    plan = _implementado(db_session, usuario, s)

    # Abierto, quedaba "controlado" para siempre sin que nadie lo cerrara.
    with pytest.raises(BadRequest):
        services.verificar_situacion(
            db_session, plan.id, plan.situaciones[0].id, verificador,
            descripcion="Mallas colocadas y revisadas", resultado="corregida",
        )
    assert mitigacion.situaciones_controladas(db_session) == {}

    # Que NO fue eficaz sí se puede decir con el incidente abierto.
    plan = services.verificar_situacion(
        db_session, plan.id, plan.situaciones[0].id, verificador,
        descripcion="El problema sigue igual que antes", resultado="no_eficaz",
    )
    assert plan.situaciones[0].estado == "no_eficaz"


def test_un_incidente_corregido_solo_vuelve_si_aparece_otro(
    db_session, usuario, verificador
):
    s = _incidente(db_session)
    plan = _verificado(db_session, usuario, verificador, s)

    services.sincronizar_con_motor(db_session, HOY + timedelta(days=3))
    assert services.obtener_plan(db_session, plan.id).situaciones[0].estado == "corregida"

    # Un incidente NUEVO del mismo tipo en el mismo elemento sí es una reaparición:
    # el control se levanta y el riesgo real ya cuenta la recurrencia nueva.
    _incidente(db_session, "inc-9")
    services.sincronizar_con_motor(db_session, HOY + timedelta(days=5))
    plan = services.obtener_plan(db_session, plan.id)
    assert plan.situaciones[0].estado == "no_eficaz"
    assert not plan.situaciones[0].controlada
    assert mitigacion.situaciones_controladas(db_session) == {}


def test_un_plan_cancelado_deja_de_controlar_lo_que_habia_verificado(
    db_session, usuario, verificador
):
    s1 = _incidente(db_session, "inc-1")
    s2 = _incidente(db_session, "inc-2")
    plan = services.crear_plan(
        db_session, _datos(usuario, s1, situaciones_adicionales=[s2.id], confirma_causa_compatible=True), usuario
    )
    services.confirmar_plan(db_session, plan.id, usuario)
    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "Hecho")
    assert mitigacion.situaciones_controladas(db_session) == {}

    # Se verifica una de las dos: queda controlada, y el plan sigue en Implementado.
    _cerrar_incidente(db_session, s1)
    plan = services.verificar_situacion(
        db_session, plan.id, plan.situaciones[0].id, verificador,
        descripcion="Mallas colocadas y revisadas", resultado="corregida",
    )
    assert plan.estado == "implementado"
    assert list(mitigacion.situaciones_controladas(db_session)) == [plan.situaciones[0].situacion_id]

    services.cancelar_plan(db_session, plan.id, "Cambió el alcance", usuario)
    assert mitigacion.situaciones_controladas(db_session) == {}


# --- Riesgo real y riesgo tratado -------------------------------------------------

def test_el_riesgo_tratado_deja_afuera_lo_controlado_y_el_real_no_cambia(db_session):
    _alerta(db_session, "inc-1", "equipo:1", impacto=3, puntaje=8.1, recurrencia=3, plan_id=7)
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)

    elemento = services._riesgo_por_elemento(db_session)["equipo:1"]

    # Real: 8,1 + 30 % de lo demás (mín(8,1; 4,0) = 4,0) = 9,3 → tope 9.
    assert elemento.puntaje == 9.0
    # Tratado: sin el incidente controlado queda solo lo otro.
    assert elemento.puntaje_tratado == 4.0
    assert elemento.en_tratamiento
    # El puntaje guardado del evento sigue siendo el real.
    assert db_session.scalar(
        select(NotificacionPersistida.puntaje).where(NotificacionPersistida.id_notificacion == "inc-1")
    ) == 8.1


def test_sin_planes_el_riesgo_tratado_es_igual_al_real(db_session):
    _alerta(db_session, "inc-1", "equipo:1", impacto=3, puntaje=8.1)
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)

    elemento = services._riesgo_por_elemento(db_session)["equipo:1"]

    assert elemento.puntaje_tratado == elemento.puntaje == 9.0
    assert not elemento.en_tratamiento


def test_la_proyeccion_es_una_estimacion_sin_los_eventos_del_plan(db_session, usuario):
    # Dos incidentes del equipo en el plan y un vencimiento ajeno al plan.
    s1 = _incidente(db_session, "inc-1", "equipo:1")
    s2 = _incidente(db_session, "inc-2", "equipo:1")
    _situacion(db_session, "calib-1", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    _alerta(db_session, "inc-1", "equipo:1", impacto=3, puntaje=8.1, recurrencia=3)
    _alerta(db_session, "inc-2", "equipo:1", impacto=3, puntaje=6.6, recurrencia=2)
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)

    filas = services.proyectar_alcance(db_session, [s1.id, s2.id])

    assert len(filas) == 1
    fila = filas[0]
    assert fila.elemento == "equipo:1" and fila.situaciones == 2
    # Hoy (real): 8,1 + 30 % de mín(8,1; 6,6 + 4,0) = 10,53 → tope 9.
    assert fila.actual_puntaje == 9.0 and fila.actual_nivel == "alto"
    # Si el plan es eficaz, los dos eventos dejan de contar: queda solo el
    # vencimiento ajeno. Un evento corregido no suma riesgo, ni siquiera impacto × 1.
    assert fila.proyectado_puntaje == 4.0 and fila.proyectado_nivel == "medio"
    # La cuenta no escribe nada: el riesgo guardado sigue igual.
    assert db_session.scalar(
        select(NotificacionPersistida.puntaje).where(NotificacionPersistida.id_notificacion == "inc-1")
    ) == 8.1


def test_si_el_plan_cubre_todo_el_elemento_el_estimado_es_sin_riesgo(db_session, usuario):
    s = _incidente(db_session)
    _alerta(db_session, "inc-1", "equipo:1", impacto=3, puntaje=8.1, recurrencia=3)

    fila = services.proyectar_alcance(db_session, [s.id])[0]

    assert fila.proyectado_puntaje == 0.0 and fila.proyectado_nivel == "sin_riesgo"


def test_el_detalle_muestra_la_proyeccion_y_guarda_real_y_tratado(
    db_session, usuario, verificador
):
    s = _incidente(db_session)
    _alerta(db_session, "inc-1", "equipo:1", impacto=3, puntaje=8.1, recurrencia=3)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)
    assert [p.elemento for p in plan.proyeccion] == ["equipo:1"]
    assert plan.riesgo_actual[0].puntaje == 8.1

    services.confirmar_plan(db_session, plan.id, usuario)
    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "Hecho")
    assert plan.proyeccion  # implementado, pero sin verificar todavía
    implementado = next(r for r in plan.riesgos if r.momento == "implementado")
    assert implementado.puntaje == implementado.puntaje_tratado == 8.1

    _cerrar_incidente(db_session, s)
    plan = services.verificar_situacion(
        db_session, plan.id, plan.situaciones[0].id, verificador,
        descripcion="Mallas colocadas y revisadas", resultado="corregida",
    )
    assert plan.proyeccion == []  # ya verificado: nada que estimar


# --- Planes con tipos mezclados en un mismo elemento ------------------------------

def test_un_plan_puede_reunir_tipos_distintos_del_mismo_elemento(db_session, usuario):
    falla = _situacion(db_session, "inc-1", tipo="FALLA_EQUIPO", elemento="equipo:1")
    calib = _situacion(db_session, "calib-1", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    plan = services.crear_plan(db_session, _datos(usuario, falla), usuario)

    # Está entre las candidatas, y se suma confirmando que comparten la causa.
    assert plan.candidatas_nuevas == 1
    plan = services.agregar_situaciones(
        db_session, plan.id, schemas.AgregarSituaciones(situacion_ids=[calib.id], confirma_causa_compatible=True), usuario
    )

    assert {s.tipo for s in plan.situaciones} == {"FALLA_EQUIPO", "PLAN_CALIBRACION_VENCIDO"}
    assert plan.tipo == "FALLA_EQUIPO"
    # La observación pide lo que pide el tipo que más pide.
    assert plan.dias_observacion >= services.dias_observacion_de(db_session, "FALLA_EQUIPO")


def test_un_tipo_distinto_de_otro_elemento_no_se_puede_sumar(db_session, usuario):
    falla = _situacion(db_session, "inc-1", tipo="FALLA_EQUIPO", elemento="equipo:1")
    ajena = _situacion(db_session, "calib-2", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:2")
    plan = services.crear_plan(db_session, _datos(usuario, falla), usuario)

    assert plan.candidatas_nuevas == 0
    with pytest.raises(BadRequest):
        services.agregar_situaciones(
            db_session, plan.id, schemas.AgregarSituaciones(situacion_ids=[ajena.id], confirma_causa_compatible=True), usuario
        )


def test_sumar_tipos_mezclados_exige_confirmar_la_causa(db_session, usuario):
    falla = _situacion(db_session, "inc-1", tipo="FALLA_EQUIPO", elemento="equipo:1")
    calib = _situacion(db_session, "calib-1", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    plan = services.crear_plan(db_session, _datos(usuario, falla), usuario)

    with pytest.raises(BadRequest):
        services.agregar_situaciones(
            db_session, plan.id, schemas.AgregarSituaciones(situacion_ids=[calib.id], confirma_causa_compatible=False), usuario
        )


def test_en_un_plan_mixto_cada_situacion_se_observa_segun_su_propio_tipo(
    db_session, usuario, verificador
):
    falla = _situacion(db_session, "inc-1", tipo="FALLA_EQUIPO", elemento="equipo:1")
    calib = _situacion(db_session, "calib-1", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    plan = services.crear_plan(db_session, _datos(usuario, falla), usuario)
    plan = services.agregar_situaciones(
        db_session, plan.id, schemas.AgregarSituaciones(situacion_ids=[calib.id], confirma_causa_compatible=True), usuario
    )
    services.confirmar_plan(db_session, plan.id, usuario)
    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "Calibrado")

    # El vencimiento lo resuelve el motor solo; la falla la confirma una persona.
    calib.resuelta_en = HOY
    db_session.commit()
    services.sincronizar_con_motor(db_session, HOY)
    _cerrar_incidente(db_session, falla)
    plan = services.verificar_situacion(
        db_session, plan.id,
        next(sp.id for sp in services.obtener_plan(db_session, plan.id).situaciones if sp.tipo == "FALLA_EQUIPO"),
        verificador, descripcion="Equipo calibrado y probado en línea", resultado="corregida",
    )
    assert plan.estado == "en_verificacion"

    # El vencimiento vuelve a aparecer: solo esa situación queda no eficaz.
    _situacion(db_session, "calib-9", tipo="PLAN_CALIBRACION_VENCIDO", elemento="equipo:1")
    services.sincronizar_con_motor(db_session, HOY + timedelta(days=2))
    estados = {sp.tipo: sp.estado for sp in services.obtener_plan(db_session, plan.id).situaciones}
    assert estados == {"FALLA_EQUIPO": "corregida", "PLAN_CALIBRACION_VENCIDO": "no_eficaz"}


# --- Próximo a vencer que vence: no es una corrección -------------------------

def test_lo_proximo_a_vencer_que_vence_no_cuenta_como_corregido(db_session, usuario):
    proximo = _situacion(db_session, "doc-1", tipo="DOCUMENTO_PROXIMO", elemento="documento:1")
    plan = services.crear_plan(db_session, _datos(usuario, proximo), usuario)
    services.confirmar_plan(db_session, plan.id, usuario)

    # El documento vence: el motor deja de ver "próximo" y ve "vencido".
    proximo.resuelta_en = HOY
    db_session.commit()
    _situacion(db_session, "doc-1", tipo="DOCUMENTO_VENCIDO", elemento="documento:1")

    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "Hecho")
    assert plan.situaciones[0].estado == "accion_implementada"  # no se autoconfirmó

    plan = services.verificar_plan(db_session, plan.id, usuario)
    assert plan.situaciones[0].estado == "no_eficaz"


def test_un_plan_activo_cubre_la_misma_familia_en_el_mismo_elemento(db_session, usuario):
    proximo = _situacion(db_session, "doc-1", tipo="DOCUMENTO_PROXIMO", elemento="documento:1")
    plan = services.crear_plan(db_session, _datos(usuario, proximo), usuario)
    vencido = _situacion(db_session, "doc-1", tipo="DOCUMENTO_VENCIDO", elemento="documento:1")
    otro = _situacion(db_session, "doc-2", tipo="DOCUMENTO_VENCIDO", elemento="documento:2")
    incidente = _incidente(db_session, "inc-1", "documento:1")

    cobertura = mitigacion.cobertura_activa(db_session)
    assert mitigacion.plan_activo_de(cobertura, vencido.id, vencido.tipo, vencido.elemento) == plan.id
    assert mitigacion.plan_activo_de(cobertura, otro.id, otro.tipo, otro.elemento) is None
    # Un incidente necesita su propio lugar en un plan.
    assert mitigacion.plan_activo_de(cobertura, incidente.id, incidente.tipo, incidente.elemento) is None


def test_lo_que_se_corrige_y_vuelve_como_otra_del_mismo_dia_tambien_vuelve(db_session, usuario):
    """Checklist: cada día incumplido es otra situación del mismo equipo."""
    ayer = _situacion(db_session, "chk-1-ayer", tipo="CHECKLIST_INCOMPLETO", elemento="equipo:1")
    plan = services.crear_plan(db_session, _datos(usuario, ayer), usuario)
    services.confirmar_plan(db_session, plan.id, usuario)
    ayer.resuelta_en = HOY
    db_session.commit()
    _situacion(db_session, "chk-1-hoy", tipo="CHECKLIST_INCOMPLETO", elemento="equipo:1")

    plan = services.completar_accion(db_session, plan.id, plan.acciones[0].id, usuario, "Hecho")
    plan = services.verificar_plan(db_session, plan.id, usuario)
    assert plan.situaciones[0].estado == "no_eficaz"


# --- Plan obligatorio: cancelación ---------------------------------------------

def _alerta_obligatoria(db, clave, elemento, puntaje=3.0, exige=True):
    db.add(
        NotificacionPersistida(
            id_notificacion=clave, tipo="INCIDENTE", entidad_id=1, titulo="Retiro",
            mensaje="Lote 5", nivel="BAJA", link_destino="/retiros/1",
            grupo_clave=elemento, criticidad="baja", motivo="x", impacto=3,
            recurrencia=1, persistencia=1, probabilidad=1.0, puntaje=puntaje,
            exige_plan=exige,
        )
    )
    db.commit()


def test_un_operador_no_puede_cancelar_un_plan_obligatorio(db_session, usuario, verificador):
    s = _situacion(db_session, "incidente-1", tipo="RETIRO_LOTE", elemento="producto:1")
    _alerta_obligatoria(db_session, "incidente-1", "producto:1")
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)

    with pytest.raises(BadRequest):
        services.cancelar_plan(db_session, plan.id, "No hace falta", verificador)

    # Quien administra sí (y la obligación vuelve a aparecer).
    plan = services.cancelar_plan(db_session, plan.id, "Se reemplaza por otro", usuario)
    assert plan.estado == "cancelado"


def test_un_elemento_en_riesgo_alto_tambien_hace_obligatorio_el_plan(db_session, usuario, verificador):
    s = _situacion(db_session, "inc-1", tipo="PLAGAS", elemento="equipo:1")
    _alerta_obligatoria(db_session, "inc-1", "equipo:1", puntaje=7.2, exige=False)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)

    with pytest.raises(BadRequest):
        services.cancelar_plan(db_session, plan.id, "No hace falta", verificador)


def test_un_operador_puede_cancelar_un_plan_que_no_es_obligatorio(db_session, usuario, verificador):
    s = _situacion(db_session)
    _alerta_obligatoria(db_session, "calib-1", "equipo:1", puntaje=2.0, exige=False)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)

    plan = services.cancelar_plan(db_session, plan.id, "Se resolvió de otra forma", verificador)
    assert plan.estado == "cancelado"


def test_la_situacion_disponible_dice_si_exige_plan(db_session, usuario):
    _situacion(db_session, "incidente-1", tipo="RETIRO_LOTE", elemento="producto:1")
    _alerta_obligatoria(db_session, "incidente-1", "producto:1")
    db_session.execute(
        NotificacionPersistida.__table__.update().values(motivo_plan="tipo")
    )
    db_session.commit()

    (disponible,) = services.situaciones_disponibles(db_session)
    assert disponible.requiere_plan and disponible.motivo_plan == "tipo"


# --- Lo que los planes ya corrigieron (últimos 30 días) ------------------------

def test_el_plan_guarda_el_ultimo_riesgo_de_sus_situaciones(db_session, usuario):
    s = _situacion(db_session, "calib-1")
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)
    plan = services.crear_plan(db_session, _datos(usuario, s), usuario)

    sp = db_session.get(services.SituacionPlan, plan.situaciones[0].id)
    assert (sp.ultimo_impacto, sp.ultima_probabilidad, sp.ultimo_puntaje) == (2, 2.0, 4.0)


def test_lo_corregido_reciente_lista_lo_que_el_plan_ya_saco(db_session, usuario):
    s = _situacion(db_session, "calib-1")
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)
    plan = _implementado(db_session, usuario, s)
    assert services.corregidas_recientes(db_session) == []  # todavía presente

    s.resuelta_en = HOY
    db_session.commit()
    plan = services.verificar_plan(db_session, plan.id, usuario)
    assert plan.situaciones[0].estado == "corregida"

    (corregida,) = services.corregidas_recientes(db_session)
    assert (corregida.plan_id, corregida.impacto, corregida.puntaje) == (plan.id, 2, 4.0)


def test_lo_corregido_hace_mas_de_30_dias_o_cancelado_no_cuenta(db_session, usuario):
    s = _situacion(db_session, "calib-1")
    _alerta(db_session, "calib-1", "equipo:1", impacto=2, puntaje=4.0)
    plan = _implementado(db_session, usuario, s)
    s.resuelta_en = HOY
    db_session.commit()
    services.verificar_plan(db_session, plan.id, usuario)

    sp = db_session.get(services.SituacionPlan, plan.situaciones[0].id)
    sp.verificada_en = HOY - timedelta(days=31)
    db_session.commit()
    assert services.corregidas_recientes(db_session) == []

    sp.verificada_en = HOY
    db_session.get(services.PlanAccion, plan.id).estado = "cancelado"
    db_session.commit()
    assert services.corregidas_recientes(db_session) == []
