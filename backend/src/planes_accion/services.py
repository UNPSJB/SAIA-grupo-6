"""Lógica de los planes de acción.

Reparto de responsabilidades:

* `reglas.py` decide (estados, vencimiento, resultado del cierre): es puro.
* Este módulo lee y escribe, y conecta el plan con el motor de riesgos.

El plan no escribe nunca sobre el impacto, el historial de situaciones ni los
puntajes. Lo que hace es dejar verificadas sus situaciones (Corregida/Eficaz),
y el motor (`notificaciones.criticidad`, vía `mitigacion.situaciones_controladas`)
las marca como controladas: su riesgo real no cambia y el riesgo tratado las deja afuera. De vuelta, el plan toma del motor lo
que detecta (si una situación sigue presente, si apareció una nueva) y el
riesgo consolidado de los elementos, que COPIA como registro (antes /
implementado / cierre) y usa para proyectar qué pasaría al verificarse.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Iterable

from fastapi import UploadFile
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from src.common.archivos import guardar_archivo
from src.common.fechas import hoy
from src.common.paginacion import paginar
from src.common.texto import contiene_texto
from src.establecimientos.contexto import sede_efectiva
from src.exceptions import BadRequest, NotFound
from src.notificaciones import riesgo
from src.notificaciones.invalidacion import asegurar_notificaciones_al_dia
from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo
from src.personal.models import Personal
from src.planes_accion import reglas, schemas
from src.planes_accion.constants import (
    DIAS_OBSERVACION_MAXIMO,
    EXTENSIONES_EVIDENCIA,
    SUBCARPETA_EVIDENCIAS,
    TAMANO_MAX_EVIDENCIA,
    ErrorCode,
    EstadoPlan,
    EstadoSituacionPlan,
    EventoHistorial,
    MomentoRiesgo,
    TipoEvidencia,
)
from src.planes_accion.elementos import nombre_elemento
from src.planes_accion.exceptions import (
    AccionNoEncontrada,
    Conflicto,
    OperacionNoPermitida,
    PlanNoEncontrado,
    SituacionNoEncontrada,
)
from src.planes_accion.models import (
    AccionPlan,
    ConfiguracionObservacion,
    EvidenciaPlan,
    HistorialPlan,
    PlanAccion,
    RiesgoElementoPlan,
    SituacionPlan,
)

_ACTIVOS = [e.value for e in reglas.ESTADOS_ACTIVOS]
_CERRADOS = [e.value for e in reglas.ESTADOS_CERRADOS]
_EN_CURSO_DE_EJECUCION = [EstadoPlan.BORRADOR.value, EstadoPlan.EN_EJECUCION.value]


# ======================================================================
# Utilidades
# ======================================================================

def _nombre(persona: Personal | None) -> str:
    if persona is None:
        return "Sistema"
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _etiqueta_tipo(tipo: str) -> str:
    datos = riesgo.TIPOS_SITUACION.get(tipo)
    return datos.etiqueta if datos else tipo


def _motor_al_dia(db: Session) -> None:
    """Pone al día lo que el motor detecta antes de leerlo. Puede hacer commit,
    por eso se llama ANTES de modificar nada."""
    asegurar_notificaciones_al_dia(db)


def _persona_activa(db: Session, persona_id: int) -> Personal:
    persona = db.get(Personal, persona_id)
    if persona is None or not persona.activo:
        raise BadRequest(ErrorCode.RESPONSABLE_INVALIDO)
    return persona


def _exigir_plazo_futuro(plazo: date | None, hoy_dia: date) -> None:
    if plazo is not None and plazo < hoy_dia:
        raise BadRequest(ErrorCode.PLAZO_PASADO)


def _plan(db: Session, plan_id: int) -> PlanAccion:
    plan = db.get(PlanAccion, plan_id)
    if plan is None:
        raise PlanNoEncontrado()
    return plan


def _exigir_estado(plan: PlanAccion, *estados: EstadoPlan) -> None:
    if plan.estado not in {e.value for e in estados}:
        raise OperacionNoPermitida()


def _exigir_editable(plan: PlanAccion) -> None:
    if not reglas.es_editable(plan.estado):
        raise OperacionNoPermitida()


def _historial(
    plan: PlanAccion,
    usuario: Personal | None,
    evento: EventoHistorial,
    detalle: str,
    *,
    anterior: str | None = None,
    nuevo: str | None = None,
) -> None:
    plan.historial.append(
        HistorialPlan(
            usuario_id=usuario.id if usuario else None,
            evento=evento.value,
            estado_anterior=anterior,
            estado_nuevo=nuevo,
            detalle=detalle,
        )
    )


def _guardar_evidencia(archivo: UploadFile | None, prefijo: str) -> tuple[str | None, str | None]:
    """Guarda el archivo (si hay) y devuelve (ruta, nombre original)."""
    if archivo is None or not archivo.filename:
        return None, None
    ruta = guardar_archivo(
        archivo,
        EXTENSIONES_EVIDENCIA,
        TAMANO_MAX_EVIDENCIA,
        prefijo,
        SUBCARPETA_EVIDENCIAS,
    )
    return ruta, archivo.filename[:255]


def _descripcion_evidencia(texto: str | None, *, minimo: int = 3) -> str:
    texto = (texto or "").strip()
    if len(texto) < minimo:
        raise BadRequest(
            ErrorCode.EVIDENCIA_REQUERIDA if minimo <= 3 else ErrorCode.EVIDENCIA_VERIFICACION_CORTA
        )
    return texto


#: Largo mínimo de la evidencia de una verificación manual: que no alcance con "ok".
MINIMO_EVIDENCIA_MANUAL = 10


def _exigir_verificador_independiente(plan: PlanAccion, usuario: Personal) -> None:
    """Quien verifica a mano no puede ser quien ejecutó el plan: si no, un plan
    "en papel" bajaría el riesgo con un clic de su propio responsable."""
    ejecutores = {plan.responsable_id, *(a.responsable_id for a in plan.acciones)}
    if usuario.id in ejecutores:
        raise OperacionNoPermitida(ErrorCode.VERIFICADOR_NO_INDEPENDIENTE)


# ======================================================================
# Lo que el motor sabe (solo lectura)
# ======================================================================

def _alertas_por_clave(db: Session) -> dict[str, NotificacionPersistida]:
    return {f.id_notificacion: f for f in db.scalars(select(NotificacionPersistida))}


def _alerta_de(
    situacion: SituacionRiesgo, alertas: dict[str, NotificacionPersistida]
) -> NotificacionPersistida | None:
    for clave in reglas.claves_de_notificacion(situacion.clave):
        if clave in alertas:
            return alertas[clave]
    return None


@dataclass(frozen=True)
class _RiesgoElemento:
    #: Riesgo REAL: lo que calcula el motor, sin planes de acción.
    puntaje: float
    #: Riesgo TRATADO: el real sin lo que un plan verificado tiene bajo control.
    puntaje_tratado: float
    etiqueta: str
    en_tratamiento: bool


def _riesgo_por_elemento(
    db: Session, excluir: frozenset[str] = frozenset()
) -> dict[str, _RiesgoElemento]:
    """Riesgo consolidado de cada elemento, real y tratado, igual que el
    dashboard del motor (`criticidad._armar_dashboard`) pero leyendo la tabla
    persistida directo, sin pasar por el recálculo.

    `excluir` son ids de notificación que además se dejan afuera del riesgo
    tratado: sirve para estimar "cómo quedaría si el plan es eficaz". Vacío =
    el riesgo de ahora."""
    grupos: dict[str, list[NotificacionPersistida]] = defaultdict(list)
    filas = db.scalars(
        select(NotificacionPersistida)
        .where(NotificacionPersistida.puntaje > 0)
        .order_by(NotificacionPersistida.puntaje.desc(), NotificacionPersistida.id)
    )
    for fila in filas:
        grupos[fila.grupo_clave or fila.id_notificacion].append(fila)

    resultado: dict[str, _RiesgoElemento] = {}
    for elemento, situaciones in grupos.items():
        sin_control = [
            f
            for f in situaciones
            if f.plan_tratamiento_id is None and f.id_notificacion not in excluir
        ]
        resultado[elemento] = _RiesgoElemento(
            puntaje=riesgo.riesgo_consolidado([f.puntaje for f in situaciones]),
            puntaje_tratado=riesgo.riesgo_consolidado([f.puntaje for f in sin_control]),
            etiqueta=situaciones[0].mensaje,
            en_tratamiento=any(f.plan_tratamiento_id is not None for f in situaciones),
        )
    return resultado


def _proyeccion(
    db: Session, situaciones: Iterable[SituacionRiesgo]
) -> list[schemas.ProyeccionElemento]:
    """ESTIMACIÓN de cómo quedaría el riesgo de cada elemento si las situaciones
    dadas se corrigen (el plan es eficaz): el real de hoy contra el consolidado
    sin ellas. Supone el mejor caso. Es una cuenta sobre lo que el motor ya
    calculó: no escribe nada."""
    alertas = _alertas_por_clave(db)
    a_sacar: set[str] = set()
    por_elemento: dict[str, int] = defaultdict(int)
    for situacion in situaciones:
        if situacion.resuelta_en is not None:
            continue
        alerta = _alerta_de(situacion, alertas)
        if alerta is None or alerta.puntaje <= 0:
            continue  # no genera riesgo: no hay nada que bajar
        a_sacar.add(alerta.id_notificacion)
        por_elemento[alerta.grupo_clave or alerta.id_notificacion] += 1
    if not por_elemento:
        return []

    actual = _riesgo_por_elemento(db)
    estimado = _riesgo_por_elemento(db, frozenset(a_sacar))
    filas = []
    for elemento, cantidad in por_elemento.items():
        hoy_ = actual[elemento]
        despues = estimado[elemento]
        filas.append(
            schemas.ProyeccionElemento(
                elemento=elemento,
                etiqueta=hoy_.etiqueta,
                situaciones=cantidad,
                actual_puntaje=hoy_.puntaje,
                actual_nivel=riesgo.nivel_de(hoy_.puntaje),
                proyectado_puntaje=despues.puntaje_tratado,
                proyectado_nivel=riesgo.nivel_de(despues.puntaje_tratado),
            )
        )
    filas.sort(key=lambda f: (-f.actual_puntaje, f.elemento))
    return filas


def _situaciones_ocupadas(db: Session) -> set[int]:
    """Situaciones que ya pertenecen a un plan activo (exclusividad). Las de un
    plan cerrado o cancelado quedan liberadas."""
    return set(
        db.scalars(
            select(SituacionPlan.situacion_id)
            .join(PlanAccion, PlanAccion.id == SituacionPlan.plan_id)
            .where(PlanAccion.estado.in_(_ACTIVOS))
        )
    )


def _situaciones_abiertas(db: Session, tipo: str | None = None) -> list[SituacionRiesgo]:
    consulta = select(SituacionRiesgo).where(
        SituacionRiesgo.resuelta_en.is_(None),
        SituacionRiesgo.tipo.in_(list(riesgo.TIPOS_SITUACION)),
    )
    if tipo is not None:
        consulta = consulta.where(SituacionRiesgo.tipo == tipo)
    return list(db.scalars(consulta.order_by(SituacionRiesgo.detectada_en, SituacionRiesgo.id)))


def _disponible(
    db: Session, situacion: SituacionRiesgo, alerta: NotificacionPersistida | None
) -> schemas.SituacionDisponible:
    etiqueta = _etiqueta_tipo(situacion.tipo)
    return schemas.SituacionDisponible(
        situacion_id=situacion.id,
        tipo=situacion.tipo,
        tipo_etiqueta=etiqueta,
        elemento=situacion.elemento,
        elemento_nombre=nombre_elemento(db, situacion.elemento),
        clave_alerta=(
            alerta.id_notificacion
            if alerta
            else reglas.claves_de_notificacion(situacion.clave)[-1]
        ),
        titulo=alerta.titulo if alerta else etiqueta,
        detalle=alerta.mensaje if alerta else "",
        detectada_en=situacion.detectada_en,
        criticidad=alerta.criticidad if alerta else None,
        puntaje=alerta.puntaje if alerta else 0.0,
        recurrencia=alerta.recurrencia if alerta else 1,
        destino=alerta.link_destino if alerta else None,
        sugerir_plan=reglas.sugerir_plan(
            alerta.criticidad if alerta else None, alerta.recurrencia if alerta else None
        ),
    )


def _situacion_para_plan(db: Session, situacion_id: int, ocupadas: set[int]) -> SituacionRiesgo:
    """Una situación que se puede tratar: existe, el motor todavía la detecta y
    no está en otro plan activo."""
    situacion = db.get(SituacionRiesgo, situacion_id)
    if situacion is None or situacion.tipo not in riesgo.TIPOS_SITUACION:
        raise SituacionNoEncontrada()
    if situacion.resuelta_en is not None:
        raise BadRequest(ErrorCode.SITUACION_RESUELTA)
    if situacion.id in ocupadas:
        raise Conflicto(ErrorCode.SITUACION_EN_OTRO_PLAN)
    return situacion


# ======================================================================
# Período de observación (configuración)
# ======================================================================

def _fila_observacion(db: Session, tipo: str) -> ConfiguracionObservacion | None:
    """La configuración de esta sede (cada establecimiento ajusta la suya)."""
    return db.get(
        ConfiguracionObservacion,
        {"establecimiento_id": sede_efectiva(db), "tipo": tipo},
    )


def dias_observacion_de(db: Session, tipo: str) -> int:
    fila = _fila_observacion(db, tipo)
    if fila is not None and reglas.dias_observacion_validos(fila.dias):
        return fila.dias
    return reglas.DIAS_OBSERVACION_DEFECTO


def _observacion_tipo(db: Session, tipo: str) -> schemas.ObservacionTipo:
    dias = dias_observacion_de(db, tipo)
    return schemas.ObservacionTipo(
        tipo=tipo,
        etiqueta=_etiqueta_tipo(tipo),
        dias=dias,
        dias_por_defecto=reglas.DIAS_OBSERVACION_DEFECTO,
        modificado=dias != reglas.DIAS_OBSERVACION_DEFECTO,
    )


def listar_observacion(db: Session) -> list[schemas.ObservacionTipo]:
    return [_observacion_tipo(db, tipo) for tipo in riesgo.TIPOS_SITUACION]


def _exigir_tipo(tipo: str) -> None:
    if tipo not in riesgo.TIPOS_SITUACION:
        raise NotFound(f"No existe el tipo de situación '{tipo}'.")


def fijar_observacion(db: Session, tipo: str, dias: int) -> schemas.ObservacionTipo:
    _exigir_tipo(tipo)
    if not reglas.dias_observacion_validos(dias):
        raise BadRequest(
            f"{ErrorCode.OBSERVACION_FUERA_DE_RANGO} "
            f"Tiene que estar entre {reglas.DIAS_OBSERVACION_MINIMO} y {DIAS_OBSERVACION_MAXIMO} días."
        )
    fila = _fila_observacion(db, tipo)
    if fila is None:
        db.add(ConfiguracionObservacion(tipo=tipo, dias=dias))
    else:
        fila.dias = dias
    db.commit()
    return _observacion_tipo(db, tipo)


def restablecer_observacion(db: Session, tipo: str) -> schemas.ObservacionTipo:
    _exigir_tipo(tipo)
    fila = _fila_observacion(db, tipo)
    if fila is not None:
        db.delete(fila)
        db.commit()
    return _observacion_tipo(db, tipo)


# ======================================================================
# Riesgo de los elementos del alcance (registro, no cálculo)
# ======================================================================

def _registrar_riesgo(
    db: Session, plan: PlanAccion, momento: MomentoRiesgo, hoy_dia: date
) -> None:
    """Copia al plan el riesgo consolidado, hoy, de cada elemento del alcance
    que todavía no tenga foto de este momento."""
    actual = _riesgo_por_elemento(db)
    ya = {(r.elemento, r.momento) for r in plan.riesgos}
    for elemento in sorted({sp.situacion.elemento for sp in plan.situaciones}):
        if (elemento, momento.value) in ya:
            continue
        dato = actual.get(elemento)
        puntaje = dato.puntaje if dato else 0.0
        plan.riesgos.append(
            RiesgoElementoPlan(
                elemento=elemento,
                etiqueta=(dato.etiqueta if dato else "")[:300],
                momento=momento.value,
                puntaje=puntaje,
                nivel=riesgo.nivel_de(puntaje),
                puntaje_tratado=dato.puntaje_tratado if dato else 0.0,
                fecha=hoy_dia,
            )
        )


# ======================================================================
# Transiciones de estado
# ======================================================================

def _cambiar_estado(
    plan: PlanAccion, nuevo: EstadoPlan, usuario: Personal | None, detalle: str
) -> None:
    anterior = plan.estado
    plan.estado = nuevo.value
    _historial(plan, usuario, EventoHistorial.ESTADO, detalle, anterior=anterior, nuevo=nuevo.value)


def _marcar_implementado(
    db: Session, plan: PlanAccion, usuario: Personal | None, hoy_dia: date
) -> None:
    """Todas las acciones se ejecutaron y tienen evidencia. Todavía no baja el
    riesgo: eso pasa recién cuando cada situación queda verificada."""
    plan.fecha_implementado = hoy_dia
    for sp in plan.situaciones:
        if sp.estado == EstadoSituacionPlan.PENDIENTE.value:
            sp.estado = EstadoSituacionPlan.ACCION_IMPLEMENTADA.value
    _cambiar_estado(plan, EstadoPlan.IMPLEMENTADO, usuario, "Todas las acciones fueron implementadas.")
    db.flush()
    _registrar_riesgo(db, plan, MomentoRiesgo.IMPLEMENTADO, hoy_dia)
    _autoconfirmar_correcciones(db, plan, hoy_dia)
    _avanzar_si_verificado(db, plan, usuario, hoy_dia)


def _autoconfirmar_correcciones(db: Session, plan: PlanAccion, hoy_dia: date) -> bool:
    """Para los tipos que detecta el motor, la corrección se confirma sola
    cuando el motor deja de detectar la situación."""
    hubo = False
    for sp in plan.situaciones:
        if sp.estado != EstadoSituacionPlan.ACCION_IMPLEMENTADA.value:
            continue
        if reglas.es_verificacion_manual(sp.situacion.tipo):
            continue
        if sp.situacion.resuelta_en is None:
            continue
        sp.estado = EstadoSituacionPlan.CORREGIDA.value
        sp.verificada_en = hoy_dia
        _historial(
            plan,
            None,
            EventoHistorial.VERIFICACION,
            "Corregida: el motor dejó de detectar la situación de "
            f"{nombre_elemento(db, sp.situacion.elemento)}.",
        )
        hubo = True
    return hubo


def _avanzar_si_verificado(
    db: Session, plan: PlanAccion, usuario: Personal | None, hoy_dia: date
) -> bool:
    """Si todas las situaciones ya tienen su verificación, pasa a En
    verificación (empieza la observación) o, si ninguna se corrigió, cierra."""
    if plan.estado != EstadoPlan.IMPLEMENTADO.value:
        return False
    estados = [sp.estado for sp in plan.situaciones]
    if not reglas.verificacion_completa(estados):
        return False
    if reglas.todas_no_eficaces(estados):
        _cerrar(db, plan, usuario, hoy_dia, "Ninguna situación quedó corregida.")
        return True

    plan.fecha_inicio_observacion = hoy_dia
    plan.fecha_fin_observacion = reglas.fin_observacion(hoy_dia, plan.dias_observacion)
    plan.situacion_id_base = db.scalar(select(func.max(SituacionRiesgo.id))) or 0
    _cambiar_estado(
        plan,
        EstadoPlan.EN_VERIFICACION,
        usuario,
        f"Verificación hecha: empieza el período de observación de {plan.dias_observacion} días "
        f"(hasta el {plan.fecha_fin_observacion.strftime('%d/%m/%Y')}).",
    )
    return True


def _cerrar(
    db: Session, plan: PlanAccion, usuario: Personal | None, hoy_dia: date, motivo: str
) -> None:
    """Cierra el plan según el resultado del conjunto. Las situaciones no
    eficaces quedan liberadas (el plan deja de estar activo)."""
    for sp in plan.situaciones:
        if sp.estado == EstadoSituacionPlan.CORREGIDA.value:
            sp.estado = EstadoSituacionPlan.EFICAZ.value
    resultado = reglas.resultado_de_cierre([sp.estado for sp in plan.situaciones])
    no_eficaces = sum(
        1 for sp in plan.situaciones if sp.estado == EstadoSituacionPlan.NO_EFICAZ.value
    )
    plan.fecha_cierre = hoy_dia
    detalle = motivo
    if no_eficaces:
        detalle += (
            f" {no_eficaces} situación(es) no eficaz(ces) quedan liberadas: para tratarlas "
            "se crea un plan nuevo vinculado a este."
        )
    _cambiar_estado(plan, resultado, usuario, detalle)
    db.flush()
    _registrar_riesgo(db, plan, MomentoRiesgo.CIERRE, hoy_dia)


def _revisar_observacion(db: Session, plan: PlanAccion, hoy_dia: date) -> bool:
    """Durante la observación: si el motor detectó una situación nueva del
    mismo tipo en un elemento del alcance, esa situación del plan pasa a No
    eficaz. Al terminar el período, el plan se cierra."""
    cambios = False
    corregidas = [
        sp for sp in plan.situaciones if sp.estado == EstadoSituacionPlan.CORREGIDA.value
    ]
    if corregidas and plan.situacion_id_base is not None:
        nuevas = {
            (tipo, elemento)
            for tipo, elemento in db.execute(
                select(SituacionRiesgo.tipo, SituacionRiesgo.elemento).where(
                    SituacionRiesgo.id > plan.situacion_id_base,
                )
            )
        }
        for sp in corregidas:
            situacion = sp.situacion
            # Un incidente (verificación manual) sigue abierto aunque su causa
            # esté corregida: que siga presente no es que haya vuelto. Para los
            # demás tipos, que el motor lo detecte otra vez sí lo es.
            volvio = situacion.resuelta_en is None and not reglas.es_verificacion_manual(
                situacion.tipo
            )
            if volvio or (situacion.tipo, situacion.elemento) in nuevas:
                sp.estado = EstadoSituacionPlan.NO_EFICAZ.value
                _historial(
                    plan,
                    None,
                    EventoHistorial.OBSERVACION,
                    "No eficaz: la situación volvió a presentarse en "
                    f"{nombre_elemento(db, situacion.elemento)} "
                    "durante el período de observación.",
                )
                cambios = True

    estados = [sp.estado for sp in plan.situaciones]
    if reglas.todas_no_eficaces(estados):
        _cerrar(db, plan, None, hoy_dia, "Ninguna situación resultó eficaz.")
        return True
    if reglas.observacion_terminada(hoy_dia, plan.fecha_fin_observacion):
        _cerrar(db, plan, None, hoy_dia, "Terminó el período de observación.")
        return True
    return cambios


def sincronizar_con_motor(db: Session, hoy_dia: date | None = None) -> int:
    """Actualiza los planes con lo que el motor detecta ahora.

    - Implementado: lo que el motor dejó de detectar pasa a Corregida.
    - En verificación: lo que vuelve a aparecer pasa a No eficaz, y al terminar
      el período el plan se cierra.

    Es idempotente. Hace commit solo si cambió algo. Se llama al leer planes
    (después de poner al día el motor), así que no depende de un proceso en
    segundo plano.
    """
    hoy_dia = hoy_dia or hoy()
    planes = db.scalars(
        select(PlanAccion).where(
            PlanAccion.estado.in_(
                [EstadoPlan.IMPLEMENTADO.value, EstadoPlan.EN_VERIFICACION.value]
            )
        )
    ).all()

    cambios = 0
    for plan in planes:
        if plan.estado == EstadoPlan.IMPLEMENTADO.value:
            hubo = _autoconfirmar_correcciones(db, plan, hoy_dia)
            avanzo = _avanzar_si_verificado(db, plan, None, hoy_dia)
            cambios += int(hubo or avanzo)
        if plan.estado == EstadoPlan.EN_VERIFICACION.value:
            cambios += int(_revisar_observacion(db, plan, hoy_dia))

    if cambios:
        db.commit()
    return cambios


# ======================================================================
# Armado de respuestas
# ======================================================================

def _evidencia_response(evidencia: EvidenciaPlan) -> schemas.EvidenciaResponse:
    return schemas.EvidenciaResponse(
        id=evidencia.id,
        tipo=evidencia.tipo,
        descripcion=evidencia.descripcion,
        archivo_url=evidencia.archivo_url,
        nombre_archivo=evidencia.nombre_archivo,
        usuario_nombre=_nombre(evidencia.usuario) if evidencia.usuario else None,
        fecha=evidencia.fecha,
    )


def _riesgo_actual(db: Session, plan: PlanAccion) -> list[schemas.RiesgoActualElemento]:
    """Riesgo de los elementos del alcance ahora, real y tratado."""
    actual = _riesgo_por_elemento(db)
    filas = []
    for elemento in sorted({sp.situacion.elemento for sp in plan.situaciones}):
        dato = actual.get(elemento)
        if dato is None:
            continue  # sin situaciones presentes: no hay riesgo que mostrar
        filas.append(
            schemas.RiesgoActualElemento(
                elemento=elemento,
                etiqueta=dato.etiqueta,
                puntaje=dato.puntaje,
                nivel=riesgo.nivel_de(dato.puntaje),
                puntaje_tratado=dato.puntaje_tratado,
                nivel_tratado=riesgo.nivel_de(dato.puntaje_tratado),
                en_tratamiento=dato.en_tratamiento,
            )
        )
    filas.sort(key=lambda f: (-f.puntaje, f.elemento))
    return filas


def _resumen(plan: PlanAccion, hoy_dia: date) -> schemas.PlanResumen:
    acciones = plan.acciones
    return schemas.PlanResumen(
        id=plan.id,
        tipo=plan.tipo,
        tipo_etiqueta=_etiqueta_tipo(plan.tipo),
        estado=plan.estado,
        objetivo=plan.objetivo,
        responsable_id=plan.responsable_id,
        responsable_nombre=_nombre(plan.responsable),
        plazo=plan.plazo,
        vencido=reglas.plan_vencido(plan.plazo, hoy_dia, plan.estado)
        or any(
            reglas.accion_vencida(a.plazo, a.completada_en is not None, hoy_dia, plan.estado)
            for a in acciones
        ),
        fecha_creacion=plan.fecha_creacion,
        fecha_fin_observacion=plan.fecha_fin_observacion,
        fecha_cierre=plan.fecha_cierre,
        acciones_total=len(acciones),
        acciones_completadas=sum(1 for a in acciones if a.completada_en is not None),
        acciones_vencidas=sum(
            1
            for a in acciones
            if reglas.accion_vencida(a.plazo, a.completada_en is not None, hoy_dia, plan.estado)
        ),
        situaciones_total=len(plan.situaciones),
        plan_anterior_id=plan.plan_anterior_id,
    )


def _candidatas(db: Session, plan: PlanAccion) -> list[SituacionRiesgo]:
    """Situaciones abiertas que se podrían sumar al plan: del mismo tipo, o de
    otro tipo pero de un elemento que ya está en el alcance."""
    if not reglas.es_editable(plan.estado):
        return []
    ocupadas = _situaciones_ocupadas(db)
    elementos = {sp.situacion.elemento for sp in plan.situaciones}
    return [
        s
        for s in _situaciones_abiertas(db)
        if s.id not in ocupadas
        and reglas.es_compatible(
            tipo_plan=plan.tipo, elementos_alcance=elementos, tipo=s.tipo, elemento=s.elemento
        )
    ]


def _detalle(db: Session, plan: PlanAccion, hoy_dia: date) -> schemas.PlanDetalle:
    # Verificar, cancelar o cerrar un plan cambia el riesgo de sus situaciones:
    # se pone al día el motor antes de leer, para no mostrar puntajes viejos.
    _motor_al_dia(db)
    alertas = _alertas_por_clave(db)
    resumen = _resumen(plan, hoy_dia)

    evidencias_por_accion: dict[int, list[EvidenciaPlan]] = defaultdict(list)
    evidencias_por_situacion: dict[int, list[EvidenciaPlan]] = defaultdict(list)
    for evidencia in plan.evidencias:
        if evidencia.accion_id is not None:
            evidencias_por_accion[evidencia.accion_id].append(evidencia)
        elif evidencia.situacion_plan_id is not None:
            evidencias_por_situacion[evidencia.situacion_plan_id].append(evidencia)

    acciones = [
        schemas.AccionResponse(
            id=a.id,
            descripcion=a.descripcion,
            responsable_id=a.responsable_id,
            responsable_nombre=_nombre(a.responsable),
            plazo=a.plazo,
            completada_en=a.completada_en,
            completada=a.completada_en is not None,
            vencida=reglas.accion_vencida(
                a.plazo, a.completada_en is not None, hoy_dia, plan.estado
            ),
            evidencias=[_evidencia_response(e) for e in evidencias_por_accion[a.id]],
        )
        for a in plan.acciones
    ]

    situaciones = []
    for sp in plan.situaciones:
        situacion = sp.situacion
        alerta = _alerta_de(situacion, alertas)
        etiqueta = _etiqueta_tipo(situacion.tipo)
        situaciones.append(
            schemas.SituacionPlanResponse(
                id=sp.id,
                situacion_id=situacion.id,
                estado=sp.estado,
                es_origen=sp.es_origen,
                tipo=situacion.tipo,
                elemento=situacion.elemento,
                elemento_nombre=nombre_elemento(db, situacion.elemento),
                titulo=alerta.titulo if alerta else etiqueta,
                detalle=alerta.mensaje if alerta else "",
                detectada_en=situacion.detectada_en,
                resuelta_en=situacion.resuelta_en,
                sigue_presente=situacion.resuelta_en is None,
                verificacion_manual=reglas.es_verificacion_manual(situacion.tipo),
                tipo_etiqueta=etiqueta,
                controlada=situacion.resuelta_en is None
                and reglas.situacion_controlada(plan.estado, sp.estado),
                verificada_en=sp.verificada_en,
                destino=alerta.link_destino if alerta else None,
                evidencias=[_evidencia_response(e) for e in evidencias_por_situacion[sp.id]],
            )
        )

    vinculados = list(
        db.scalars(
            select(PlanAccion.id)
            .where(PlanAccion.plan_anterior_id == plan.id)
            .order_by(PlanAccion.id)
        )
    )

    return schemas.PlanDetalle(
        **resumen.model_dump(),
        causa=plan.causa,
        criterio_eficacia=plan.criterio_eficacia,
        dias_observacion=plan.dias_observacion,
        creado_por_nombre=_nombre(plan.creado_por),
        fecha_implementado=plan.fecha_implementado,
        fecha_inicio_observacion=plan.fecha_inicio_observacion,
        motivo_cancelacion=plan.motivo_cancelacion,
        editable=reglas.es_editable(plan.estado),
        cancelable=reglas.es_cancelable(plan.estado),
        candidatas_nuevas=len(_candidatas(db, plan)),
        acciones=acciones,
        situaciones=situaciones,
        historial=[
            schemas.HistorialResponse(
                id=h.id,
                fecha=h.fecha,
                usuario_nombre=_nombre(h.usuario) if h.usuario else None,
                evento=h.evento,
                estado_anterior=h.estado_anterior,
                estado_nuevo=h.estado_nuevo,
                detalle=h.detalle,
            )
            for h in plan.historial
        ],
        proyeccion=(
            _proyeccion(
                db,
                [
                    sp.situacion
                    for sp in plan.situaciones
                    if sp.estado
                    in (
                        EstadoSituacionPlan.PENDIENTE.value,
                        EstadoSituacionPlan.ACCION_IMPLEMENTADA.value,
                    )
                ],
            )
            if plan.estado
            in (
                EstadoPlan.BORRADOR.value,
                EstadoPlan.EN_EJECUCION.value,
                EstadoPlan.IMPLEMENTADO.value,
            )
            else []
        ),
        riesgo_actual=_riesgo_actual(db, plan),
        riesgos=[
            schemas.RiesgoElementoResponse(
                elemento=r.elemento,
                etiqueta=r.etiqueta,
                momento=r.momento,
                puntaje=r.puntaje,
                nivel=r.nivel,
                # Registros viejos sin riesgo tratado: se toma el real.
                puntaje_tratado=r.puntaje if r.puntaje_tratado is None else r.puntaje_tratado,
                nivel_tratado=riesgo.nivel_de(
                    r.puntaje if r.puntaje_tratado is None else r.puntaje_tratado
                ),
                fecha=r.fecha,
            )
            for r in plan.riesgos
        ],
        planes_vinculados=vinculados,
    )


# ======================================================================
# Lectura
# ======================================================================

def listar_planes(
    db: Session,
    *,
    grupo: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    buscar: str | None = None,
    vencidos: bool = False,
    page: int | None = None,
    page_size: int = 10,
) -> tuple[list[schemas.PlanResumen], int]:
    _motor_al_dia(db)
    sincronizar_con_motor(db)
    hoy_dia = hoy()

    consulta = select(PlanAccion)
    if estado:
        consulta = consulta.where(PlanAccion.estado == estado)
    elif grupo == "activos":
        consulta = consulta.where(PlanAccion.estado.in_(_ACTIVOS))
    elif grupo == "finalizados":
        consulta = consulta.where(
            PlanAccion.estado.in_(_CERRADOS + [EstadoPlan.CANCELADO.value])
        )
    if tipo:
        consulta = consulta.where(PlanAccion.tipo == tipo)
    if buscar and buscar.strip():
        texto = buscar.strip()
        condiciones = [
            contiene_texto(PlanAccion.objetivo, texto),
            contiene_texto(PlanAccion.causa, texto),
        ]
        if texto.isdigit():
            condiciones.append(PlanAccion.id == int(texto))
        consulta = consulta.where(or_(*condiciones))
    if vencidos:
        accion_vencida = exists().where(
            AccionPlan.plan_id == PlanAccion.id,
            AccionPlan.completada_en.is_(None),
            AccionPlan.plazo < hoy_dia,
        )
        consulta = consulta.where(
            PlanAccion.estado.in_(_EN_CURSO_DE_EJECUCION),
            or_(and_(PlanAccion.plazo.is_not(None), PlanAccion.plazo < hoy_dia), accion_vencida),
        )
    consulta = consulta.order_by(PlanAccion.id.desc())

    if page is None:
        planes = list(db.scalars(consulta))
        total = len(planes)
    else:
        planes, total = paginar(db, consulta, page, page_size)
    return [_resumen(p, hoy_dia) for p in planes], total


def obtener_plan(db: Session, plan_id: int) -> schemas.PlanDetalle:
    _motor_al_dia(db)
    sincronizar_con_motor(db)
    return _detalle(db, _plan(db, plan_id), hoy())


def situaciones_disponibles(db: Session, tipo: str | None = None) -> list[schemas.SituacionDisponible]:
    """Situaciones presentes que se pueden tratar con un plan: las que el motor
    detecta ahora y no están en otro plan activo."""
    _motor_al_dia(db)
    ocupadas = _situaciones_ocupadas(db)
    alertas = _alertas_por_clave(db)
    disponibles = [
        _disponible(db, s, _alerta_de(s, alertas))
        for s in _situaciones_abiertas(db, tipo)
        if s.id not in ocupadas
    ]
    # Primero lo que SAIA sugiere tratar, y dentro de eso lo más riesgoso.
    disponibles.sort(key=lambda d: (not d.sugerir_plan, -d.puntaje, d.detectada_en))
    return disponibles


def proyectar_alcance(db: Session, situacion_ids: list[int]) -> list[schemas.ProyeccionElemento]:
    """Riesgo actual de los elementos y cómo quedaría si el plan que trate
    estas situaciones se implementara y verificara. Para mostrar mientras se
    arma el alcance de un plan."""
    _motor_al_dia(db)
    situaciones = []
    for situacion_id in dict.fromkeys(situacion_ids):
        situacion = db.get(SituacionRiesgo, situacion_id)
        if situacion is None:
            raise SituacionNoEncontrada()
        situaciones.append(situacion)
    return _proyeccion(db, situaciones)


def situaciones_con_plan(db: Session) -> list[schemas.SituacionConPlan]:
    """Situaciones presentes que ya están en un plan activo, para que el centro
    de notificaciones muestre el plan en vez de ofrecer crear otro."""
    _motor_al_dia(db)
    sincronizar_con_motor(db)
    alertas = _alertas_por_clave(db)
    filas = db.execute(
        select(SituacionPlan, PlanAccion)
        .join(PlanAccion, PlanAccion.id == SituacionPlan.plan_id)
        .where(PlanAccion.estado.in_(_ACTIVOS))
        .order_by(PlanAccion.id)
    ).all()
    resultado = []
    for sp, plan in filas:
        situacion = sp.situacion
        if situacion.resuelta_en is not None:
            continue
        alerta = _alerta_de(situacion, alertas)
        clave = alerta.id_notificacion if alerta else reglas.claves_de_notificacion(situacion.clave)[-1]
        resultado.append(
            schemas.SituacionConPlan(clave_alerta=clave, plan_id=plan.id, plan_estado=plan.estado)
        )
    return resultado


def listar_responsables(db: Session) -> list[schemas.ResponsablePosible]:
    """Personal activo, para elegir responsables. Quien opera no puede listar
    el personal (es de administración), pero sí tiene que poder asignar."""
    personas = db.scalars(
        select(Personal)
        .where(Personal.activo.is_(True))
        .order_by(Personal.apellido, Personal.nombre)
    )
    return [schemas.ResponsablePosible(id=p.id, nombre=_nombre(p)) for p in personas]


def candidatas_de_plan(db: Session, plan_id: int) -> list[schemas.SituacionDisponible]:
    _motor_al_dia(db)
    plan = _plan(db, plan_id)
    alertas = _alertas_por_clave(db)
    return [_disponible(db, s, _alerta_de(s, alertas)) for s in _candidatas(db, plan)]


# ======================================================================
# Escritura: plan
# ======================================================================

def _agregar_accion(db: Session, plan: PlanAccion, datos: schemas.AccionCrear, hoy_dia: date) -> AccionPlan:
    _persona_activa(db, datos.responsable_id)
    _exigir_plazo_futuro(datos.plazo, hoy_dia)
    accion = AccionPlan(
        descripcion=datos.descripcion,
        responsable_id=datos.responsable_id,
        plazo=datos.plazo,
    )
    plan.acciones.append(accion)
    return accion


def _sumar_situaciones(
    db: Session,
    plan: PlanAccion,
    ids: list[int],
    confirma_causa: bool,
    usuario: Personal,
    hoy_dia: date,
) -> int:
    """Suma al alcance las situaciones que el usuario confirma. Dos situaciones
    del mismo tipo (o del mismo elemento) no tienen necesariamente la misma
    causa: sin la confirmación explícita no se suma ninguna. Un tipo distinto
    solo entra si es de un elemento que ya está en el alcance."""
    nuevos = [i for i in dict.fromkeys(ids)]  # sin repetidos, en orden
    if not nuevos:
        return 0
    if not confirma_causa:
        raise BadRequest(ErrorCode.CAUSA_NO_CONFIRMADA)

    ocupadas = _situaciones_ocupadas(db)
    en_plan = {sp.situacion_id for sp in plan.situaciones}
    situaciones = []
    for situacion_id in nuevos:
        if situacion_id in en_plan:
            raise Conflicto("La situación ya está en el alcance de este plan.")
        situaciones.append(_situacion_para_plan(db, situacion_id, ocupadas))

    # Elementos que justifican sumar un tipo distinto: los que ya están en el
    # alcance y los de lo que se suma ahora del tipo del plan (no depende del
    # orden en que lleguen).
    elementos = {sp.situacion.elemento for sp in plan.situaciones} | {
        s.elemento for s in situaciones if s.tipo == plan.tipo
    }
    for situacion in situaciones:
        if not reglas.es_compatible(
            tipo_plan=plan.tipo,
            elementos_alcance=elementos,
            tipo=situacion.tipo,
            elemento=situacion.elemento,
        ):
            raise BadRequest(ErrorCode.SITUACION_OTRO_TIPO)
        # Con tipos mezclados, el plan observa lo que pide el que más pide.
        plan.dias_observacion = max(plan.dias_observacion, dias_observacion_de(db, situacion.tipo))
        plan.situaciones.append(
            SituacionPlan(
                situacion_id=situacion.id,
                situacion=situacion,
                estado=EstadoSituacionPlan.PENDIENTE.value,
                es_origen=False,
                agregada_en=hoy_dia,
            )
        )
        _historial(
            plan,
            usuario,
            EventoHistorial.ALCANCE,
            f"Se sumó al alcance la situación de {nombre_elemento(db, situacion.elemento)} "
            f"({_etiqueta_tipo(situacion.tipo)}), confirmando que comparte la causa del plan.",
        )
    return len(nuevos)


def crear_plan(db: Session, datos: schemas.PlanCrear, usuario: Personal) -> schemas.PlanDetalle:
    _motor_al_dia(db)
    hoy_dia = hoy()

    ocupadas = _situaciones_ocupadas(db)
    origen = _situacion_para_plan(db, datos.situacion_origen_id, ocupadas)
    _persona_activa(db, datos.responsable_id)
    _exigir_plazo_futuro(datos.plazo, hoy_dia)

    if datos.plan_anterior_id is not None:
        anterior = db.get(PlanAccion, datos.plan_anterior_id)
        if anterior is None or not reglas.es_cerrado(anterior.estado):
            raise BadRequest(ErrorCode.PLAN_ANTERIOR_INVALIDO)
        if anterior.tipo != origen.tipo and origen.elemento not in {
            sp.situacion.elemento for sp in anterior.situaciones
        }:
            raise BadRequest(ErrorCode.PLAN_ANTERIOR_OTRO_TIPO)

    plan = PlanAccion(
        tipo=origen.tipo,
        estado=EstadoPlan.BORRADOR.value,
        situacion_origen_id=origen.id,
        causa=datos.causa,
        objetivo=datos.objetivo,
        criterio_eficacia=datos.criterio_eficacia,
        responsable_id=datos.responsable_id,
        creado_por_id=usuario.id,
        plan_anterior_id=datos.plan_anterior_id,
        plazo=datos.plazo,
        dias_observacion=dias_observacion_de(db, origen.tipo),
    )
    plan.situaciones.append(
        SituacionPlan(
            situacion_id=origen.id,
            # También el objeto: `_sumar_situaciones` lo lee antes del flush.
            situacion=origen,
            estado=EstadoSituacionPlan.PENDIENTE.value,
            es_origen=True,
            agregada_en=hoy_dia,
        )
    )
    for accion in datos.acciones:
        _agregar_accion(db, plan, accion, hoy_dia)

    detalle = f"Plan creado desde la situación de {nombre_elemento(db, origen.elemento)}."
    if datos.plan_anterior_id is not None:
        detalle += f" Continúa el plan #{datos.plan_anterior_id}."
    _historial(plan, usuario, EventoHistorial.CREACION, detalle, nuevo=EstadoPlan.BORRADOR.value)

    # Las adicionales se validan contra lo ocupado ANTES de crear el plan: la
    # origen todavía no figura en ningún plan, así que no choca consigo misma.
    _sumar_situaciones(
        db, plan, datos.situaciones_adicionales, datos.confirma_causa_compatible, usuario, hoy_dia
    )

    db.add(plan)
    db.flush()
    _registrar_riesgo(db, plan, MomentoRiesgo.ANTES, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)


def actualizar_plan(
    db: Session, plan_id: int, datos: schemas.PlanActualizar, usuario: Personal
) -> schemas.PlanDetalle:
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    hoy_dia = hoy()
    cambios = []

    for campo, etiqueta in (
        ("causa", "la causa"),
        ("objetivo", "el objetivo"),
        ("criterio_eficacia", "el criterio de eficacia"),
    ):
        nuevo = getattr(datos, campo)
        if nuevo is not None and nuevo != getattr(plan, campo):
            setattr(plan, campo, nuevo)
            cambios.append(etiqueta)

    if datos.responsable_id is not None and datos.responsable_id != plan.responsable_id:
        persona = _persona_activa(db, datos.responsable_id)
        plan.responsable_id = persona.id
        cambios.append(f"el responsable general ({_nombre(persona)})")

    if datos.quitar_plazo:
        if plan.plazo is not None:
            plan.plazo = None
            cambios.append("el plazo (se quitó)")
    elif datos.plazo is not None and datos.plazo != plan.plazo:
        _exigir_plazo_futuro(datos.plazo, hoy_dia)
        plan.plazo = datos.plazo
        cambios.append("el plazo")

    if cambios:
        _historial(plan, usuario, EventoHistorial.EDICION, "Se modificó " + ", ".join(cambios) + ".")
    db.commit()
    return _detalle(db, plan, hoy_dia)


def confirmar_plan(db: Session, plan_id: int, usuario: Personal) -> schemas.PlanDetalle:
    """Borrador → En ejecución: se confirman el alcance y las acciones."""
    plan = _plan(db, plan_id)
    _exigir_estado(plan, EstadoPlan.BORRADOR)
    if not plan.acciones:
        raise BadRequest(ErrorCode.PLAN_SIN_ACCIONES)
    _cambiar_estado(plan, EstadoPlan.EN_EJECUCION, usuario, "Se confirmaron el alcance y las acciones.")
    db.commit()
    return _detalle(db, plan, hoy())


def cancelar_plan(
    db: Session, plan_id: int, motivo: str, usuario: Personal
) -> schemas.PlanDetalle:
    """Se descarta el plan, con justificación. Todas sus situaciones quedan liberadas."""
    plan = _plan(db, plan_id)
    if not reglas.es_cancelable(plan.estado):
        raise OperacionNoPermitida()
    hoy_dia = hoy()
    plan.motivo_cancelacion = motivo
    plan.fecha_cierre = hoy_dia
    _cambiar_estado(plan, EstadoPlan.CANCELADO, usuario, f"Plan cancelado: {motivo}")
    db.commit()
    return _detalle(db, plan, hoy_dia)


# ======================================================================
# Escritura: acciones
# ======================================================================

def _accion(plan: PlanAccion, accion_id: int) -> AccionPlan:
    for accion in plan.acciones:
        if accion.id == accion_id:
            return accion
    raise AccionNoEncontrada()


def agregar_accion(
    db: Session, plan_id: int, datos: schemas.AccionCrear, usuario: Personal
) -> schemas.PlanDetalle:
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    hoy_dia = hoy()
    _agregar_accion(db, plan, datos, hoy_dia)
    _historial(plan, usuario, EventoHistorial.ACCION, f"Se agregó la acción: {datos.descripcion}")
    db.commit()
    return _detalle(db, plan, hoy_dia)


def actualizar_accion(
    db: Session,
    plan_id: int,
    accion_id: int,
    datos: schemas.AccionActualizar,
    usuario: Personal,
) -> schemas.PlanDetalle:
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    accion = _accion(plan, accion_id)
    if accion.completada_en is not None:
        raise Conflicto(ErrorCode.ACCION_COMPLETADA)
    hoy_dia = hoy()

    if datos.descripcion is not None:
        accion.descripcion = datos.descripcion
    if datos.responsable_id is not None:
        accion.responsable_id = _persona_activa(db, datos.responsable_id).id
    if datos.plazo is not None and datos.plazo != accion.plazo:
        _exigir_plazo_futuro(datos.plazo, hoy_dia)
        accion.plazo = datos.plazo
    _historial(plan, usuario, EventoHistorial.ACCION, f"Se modificó la acción: {accion.descripcion}")
    db.commit()
    return _detalle(db, plan, hoy_dia)


def eliminar_accion(
    db: Session, plan_id: int, accion_id: int, usuario: Personal
) -> schemas.PlanDetalle:
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    accion = _accion(plan, accion_id)
    if accion.completada_en is not None:
        raise Conflicto(ErrorCode.ACCION_COMPLETADA)
    if plan.estado == EstadoPlan.EN_EJECUCION.value and len(plan.acciones) == 1:
        raise BadRequest(ErrorCode.PLAN_SIN_ACCIONES)

    hoy_dia = hoy()
    descripcion = accion.descripcion
    plan.acciones.remove(accion)
    _historial(plan, usuario, EventoHistorial.ACCION, f"Se quitó la acción: {descripcion}")
    db.flush()

    # Si lo que quedaba pendiente era justo esa acción, el plan ya está implementado.
    if (
        plan.estado == EstadoPlan.EN_EJECUCION.value
        and plan.acciones
        and all(a.completada_en is not None for a in plan.acciones)
    ):
        _marcar_implementado(db, plan, usuario, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)


def completar_accion(
    db: Session,
    plan_id: int,
    accion_id: int,
    usuario: Personal,
    descripcion: str,
    archivo: UploadFile | None = None,
) -> schemas.PlanDetalle:
    """Completa una acción con su evidencia de implementación. Si era la
    última, el plan pasa a Implementado."""
    _motor_al_dia(db)
    plan = _plan(db, plan_id)
    _exigir_estado(plan, EstadoPlan.EN_EJECUCION)
    accion = _accion(plan, accion_id)
    if accion.completada_en is not None:
        raise Conflicto(ErrorCode.ACCION_COMPLETADA)
    texto = _descripcion_evidencia(descripcion)

    hoy_dia = hoy()
    # El archivo se guarda recién cuando todo lo demás está validado.
    ruta, nombre = _guardar_evidencia(archivo, f"plan{plan.id}-accion{accion.id}")
    plan.evidencias.append(
        EvidenciaPlan(
            tipo=TipoEvidencia.IMPLEMENTACION.value,
            accion_id=accion.id,
            descripcion=texto,
            archivo_url=ruta,
            nombre_archivo=nombre,
            usuario_id=usuario.id,
        )
    )
    accion.completada_en = hoy_dia
    accion.completada_por_id = usuario.id
    _historial(plan, usuario, EventoHistorial.ACCION, f"Acción completada: {accion.descripcion}")
    db.flush()

    if all(a.completada_en is not None for a in plan.acciones):
        _marcar_implementado(db, plan, usuario, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)


# ======================================================================
# Escritura: alcance
# ======================================================================

def agregar_situaciones(
    db: Session, plan_id: int, datos: schemas.AgregarSituaciones, usuario: Personal
) -> schemas.PlanDetalle:
    _motor_al_dia(db)
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    hoy_dia = hoy()
    _sumar_situaciones(
        db, plan, datos.situacion_ids, datos.confirma_causa_compatible, usuario, hoy_dia
    )
    db.flush()
    _registrar_riesgo(db, plan, MomentoRiesgo.ANTES, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)


def quitar_situacion(
    db: Session, plan_id: int, situacion_plan_id: int, usuario: Personal
) -> schemas.PlanDetalle:
    plan = _plan(db, plan_id)
    _exigir_editable(plan)
    sp = next((s for s in plan.situaciones if s.id == situacion_plan_id), None)
    if sp is None:
        raise SituacionNoEncontrada()
    if sp.es_origen:
        raise BadRequest(ErrorCode.NO_ES_ORIGEN)

    elemento = sp.situacion.elemento
    plan.situaciones.remove(sp)
    # Si el elemento ya no está en el alcance, su foto de "antes" tampoco corresponde.
    if not any(s.situacion.elemento == elemento for s in plan.situaciones):
        for registro in [r for r in plan.riesgos if r.elemento == elemento]:
            plan.riesgos.remove(registro)
    _historial(
        plan,
        usuario,
        EventoHistorial.ALCANCE,
        f"Se quitó del alcance la situación de {nombre_elemento(db, elemento)}.",
    )
    db.commit()
    return _detalle(db, plan, hoy())


# ======================================================================
# Escritura: verificación
# ======================================================================

def _situacion_del_plan(plan: PlanAccion, situacion_plan_id: int) -> SituacionPlan:
    for sp in plan.situaciones:
        if sp.id == situacion_plan_id:
            return sp
    raise SituacionNoEncontrada()


def verificar_plan(db: Session, plan_id: int, usuario: Personal) -> schemas.PlanDetalle:
    """Verifica, con lo que el motor detecta ahora, todas las situaciones
    pendientes de tipos que el motor detecta: la que ya no detecta queda
    Corregida; la que sigue presente, No eficaz. Las de tipos que no detecta
    el motor se verifican una por una, con su evidencia."""
    _motor_al_dia(db)
    plan = _plan(db, plan_id)
    _exigir_estado(plan, EstadoPlan.IMPLEMENTADO)
    hoy_dia = hoy()

    for sp in plan.situaciones:
        if sp.estado != EstadoSituacionPlan.ACCION_IMPLEMENTADA.value:
            continue
        situacion = sp.situacion
        if reglas.es_verificacion_manual(situacion.tipo):
            continue
        sp.estado = reglas.decidir_verificacion(
            tipo=situacion.tipo, sigue_presente=situacion.resuelta_en is None
        ).value
        sp.verificada_en = hoy_dia
        resultado = (
            "Corregida: el motor ya no la detecta."
            if sp.estado == EstadoSituacionPlan.CORREGIDA.value
            else "No eficaz: la condición sigue presente."
        )
        _historial(
            plan,
            usuario,
            EventoHistorial.VERIFICACION,
            f"{nombre_elemento(db, situacion.elemento)}. {resultado}",
        )

    db.flush()
    _avanzar_si_verificado(db, plan, usuario, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)


def verificar_situacion(
    db: Session,
    plan_id: int,
    situacion_plan_id: int,
    usuario: Personal,
    *,
    descripcion: str | None = None,
    resultado: str | None = None,
    archivo: UploadFile | None = None,
) -> schemas.PlanDetalle:
    """Verificación de UNA situación del alcance.

    Para los tipos que detecta el motor el resultado sale de lo que el motor
    detecta (no se puede forzar) y la evidencia es opcional. Para los demás,
    quien verifica indica el resultado y la evidencia es obligatoria.
    """
    _motor_al_dia(db)
    plan = _plan(db, plan_id)
    _exigir_estado(plan, EstadoPlan.IMPLEMENTADO, EstadoPlan.EN_VERIFICACION)
    sp = _situacion_del_plan(plan, situacion_plan_id)
    situacion = sp.situacion
    manual = reglas.es_verificacion_manual(situacion.tipo)
    hoy_dia = hoy()

    decide = (
        plan.estado == EstadoPlan.IMPLEMENTADO.value
        and sp.estado == EstadoSituacionPlan.ACCION_IMPLEMENTADA.value
    )
    if manual:
        # Sin evidencia y sin resultado no hay verificación manual.
        if not decide:
            raise BadRequest(ErrorCode.SITUACION_NO_VERIFICABLE)
        _exigir_verificador_independiente(plan, usuario)
        texto = _descripcion_evidencia(descripcion, minimo=MINIMO_EVIDENCIA_MANUAL)
        try:
            nuevo = reglas.decidir_verificacion(
                tipo=situacion.tipo, sigue_presente=False, resultado_manual=resultado
            )
        except ValueError:
            raise BadRequest(ErrorCode.VERIFICACION_MANUAL)
    else:
        texto = (descripcion or "").strip() or None
        if texto is not None and len(texto) < 3:
            raise BadRequest(ErrorCode.EVIDENCIA_REQUERIDA)
        nuevo = (
            reglas.decidir_verificacion(
                tipo=situacion.tipo, sigue_presente=situacion.resuelta_en is None
            )
            if decide
            else None
        )
        if not decide and texto is None and archivo is None:
            raise BadRequest(ErrorCode.SITUACION_NO_VERIFICABLE)

    ruta, nombre = _guardar_evidencia(archivo, f"plan{plan.id}-situacion{sp.id}")
    if texto is not None or ruta is not None:
        plan.evidencias.append(
            EvidenciaPlan(
                tipo=TipoEvidencia.VERIFICACION.value,
                situacion_plan_id=sp.id,
                descripcion=texto or (nombre or "Archivo adjunto"),
                archivo_url=ruta,
                nombre_archivo=nombre,
                usuario_id=usuario.id,
            )
        )

    if nuevo is not None:
        sp.estado = nuevo.value
        sp.verificada_en = hoy_dia
        resultado_txt = (
            "Corregida."
            if nuevo == EstadoSituacionPlan.CORREGIDA
            else "No eficaz: la condición sigue presente."
        )
        _historial(
            plan,
            usuario,
            EventoHistorial.VERIFICACION,
            f"{nombre_elemento(db, situacion.elemento)}. {resultado_txt}",
        )
    else:
        _historial(
            plan, usuario, EventoHistorial.EVIDENCIA,
            f"Se agregó evidencia de verificación en {nombre_elemento(db, situacion.elemento)}.",
        )

    db.flush()
    _avanzar_si_verificado(db, plan, usuario, hoy_dia)
    db.commit()
    return _detalle(db, plan, hoy_dia)
