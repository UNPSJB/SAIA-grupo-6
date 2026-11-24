"""Reglas puras del plan de acción: sin base de datos ni FastAPI.

Acá vive todo lo que es "decisión" (qué estado corresponde, cuándo vence,
cuándo se sugiere un plan), para poder probarlo sin infraestructura. Los
services solo leen y escriben.

Principio rector (sección 1 del documento funcional): el plan TRATA, el motor
EVALÚA. Nada de este módulo calcula riesgo: solo decide cuándo una situación
cuenta como CONTROLADA (plan verificado). El motor la marca y calcula aparte el
riesgo tratado; el riesgo real no se toca.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from src.notificaciones import riesgo
from src.planes_accion.constants import (
    DIAS_OBSERVACION_MAXIMO,
    EstadoPlan,
    EstadoSituacionPlan,
)

# ============================================================
# ESTADOS DEL PLAN
# ============================================================

#: El plan sigue vivo: sus situaciones están ocupadas (exclusividad).
ESTADOS_ACTIVOS = frozenset(
    {
        EstadoPlan.BORRADOR,
        EstadoPlan.EN_EJECUCION,
        EstadoPlan.IMPLEMENTADO,
        EstadoPlan.EN_VERIFICACION,
    }
)

ESTADOS_CERRADOS = frozenset(
    {
        EstadoPlan.CERRADO_EFICAZ,
        EstadoPlan.CERRADO_PARCIAL,
        EstadoPlan.CERRADO_NO_EFICAZ,
    }
)

#: Mientras el plan está acá se pueden editar los datos, sumar o quitar
#: acciones y modificar el alcance. Desde Implementado el alcance se cierra,
#: para no alterar la verificación ni el período de observación.
ESTADOS_EDITABLES = frozenset({EstadoPlan.BORRADOR, EstadoPlan.EN_EJECUCION})

ESTADOS_CANCELABLES = frozenset(
    {EstadoPlan.BORRADOR, EstadoPlan.EN_EJECUCION, EstadoPlan.IMPLEMENTADO}
)

#: Estados en los que un plazo vencido todavía importa (no llegó a Implementado).
_ESTADOS_PARA_VENCIMIENTO = frozenset({EstadoPlan.BORRADOR, EstadoPlan.EN_EJECUCION})

ESTADOS_SITUACION_VERIFICADA = frozenset(
    {EstadoSituacionPlan.CORREGIDA, EstadoSituacionPlan.NO_EFICAZ}
)

#: Tipos de situación cuya corrección el motor no puede confirmar solo: los
#: incidentes. Un incidente sigue abierto aunque la causa ya esté corregida
#: (alguien tiene que cerrarlo), así que "el motor ya no lo detecta" no sirve
#: como prueba. Para esos tipos la corrección la confirma una persona, con su
#: evidencia, y la situación pasa a estar CONTROLADA por el plan.
#: Los demás tipos (stock, checklists, vencimientos) los observa el motor y se
#: confirman solos cuando dejan de detectarse.
TIPOS_VERIFICACION_MANUAL: frozenset[str] = riesgo.TIPOS_DE_INCIDENTE

#: Estados del plan desde los que sus situaciones verificadas cuentan como
#: controladas. En Cancelado no: un plan cancelado no controló nada. En Cerrado
#: no eficaz tampoco: ninguna situación quedó eficaz.
ESTADOS_PLAN_QUE_CONTROLAN = frozenset(
    {
        EstadoPlan.IMPLEMENTADO,
        EstadoPlan.EN_VERIFICACION,
        EstadoPlan.CERRADO_EFICAZ,
        EstadoPlan.CERRADO_PARCIAL,
    }
)

#: Estados de la situación dentro del plan que cuentan como controlada.
ESTADOS_SITUACION_CONTROLADA = frozenset(
    {EstadoSituacionPlan.CORREGIDA, EstadoSituacionPlan.EFICAZ}
)


def situacion_controlada(estado_plan, estado_situacion) -> bool:
    """La situación ya está verificada por un plan que sigue en pie. El motor
    sigue calculando su riesgo REAL igual que siempre; el riesgo TRATADO la deja
    afuera. Pendiente, Acción implementada (sin verificar) y No eficaz no
    cuentan."""
    return (
        _valor(estado_plan) in {e.value for e in ESTADOS_PLAN_QUE_CONTROLAN}
        and _valor(estado_situacion) in {e.value for e in ESTADOS_SITUACION_CONTROLADA}
    )


def es_compatible(
    *, tipo_plan: str, elementos_alcance: Iterable[str], tipo: str, elemento: str
) -> bool:
    """Una situación se puede sumar a un plan si es del mismo tipo que el plan o
    si es de otro tipo pero del MISMO ELEMENTO que alguna del alcance (p. ej. un
    equipo sin calibrar con una calibración vencida y una falla del equipo). En
    ambos casos, quien suma confirma que comparten la causa."""
    return tipo == tipo_plan or elemento in set(elementos_alcance)


def _valor(estado) -> str:
    return estado.value if hasattr(estado, "value") else str(estado)


def es_activo(estado) -> bool:
    return _valor(estado) in {e.value for e in ESTADOS_ACTIVOS}


def es_editable(estado) -> bool:
    return _valor(estado) in {e.value for e in ESTADOS_EDITABLES}


def es_cancelable(estado) -> bool:
    return _valor(estado) in {e.value for e in ESTADOS_CANCELABLES}


def es_cerrado(estado) -> bool:
    return _valor(estado) in {e.value for e in ESTADOS_CERRADOS}


# ============================================================
# VENCIMIENTO (marca independiente, no es un estado)
# ============================================================

def plan_vencido(plazo: date | None, hoy: date, estado) -> bool:
    """Se superó el plazo del plan sin haber llegado a Implementado."""
    if plazo is None:
        return False
    return _valor(estado) in {e.value for e in _ESTADOS_PARA_VENCIMIENTO} and plazo < hoy


def accion_vencida(plazo: date | None, completada: bool, hoy: date, estado_plan) -> bool:
    """Se superó el plazo de la acción sin haberse completado."""
    if plazo is None or completada:
        return False
    return _valor(estado_plan) in {e.value for e in _ESTADOS_PARA_VENCIMIENTO} and plazo < hoy


# ============================================================
# SUGERENCIA DE PLAN
# ============================================================

#: Puntaje de recurrencia (1 a 3) desde el cual se considera "elevada".
RECURRENCIA_ELEVADA = 3


def sugerir_plan(criticidad: str | None, recurrencia: int | None) -> bool:
    """SAIA sugiere (no impone) un plan para situaciones de riesgo alto o con
    recurrencia elevada. La decisión de tratarla es siempre del usuario."""
    return criticidad == "alta" or (recurrencia or 0) >= RECURRENCIA_ELEVADA


# ============================================================
# VERIFICACIÓN Y CIERRE
# ============================================================

def es_verificacion_manual(tipo: str) -> bool:
    return tipo in TIPOS_VERIFICACION_MANUAL


def decidir_verificacion(
    *,
    tipo: str,
    sigue_presente: bool,
    resultado_manual: str | None = None,
) -> EstadoSituacionPlan:
    """Resultado de verificar una situación del alcance.

    - Tipo detectado por el motor: si ya no la detecta, Corregida; si sigue
      presente, No eficaz. No se puede forzar a mano.
    - Tipo que no detecta el motor: lo decide quien verifica
      (`resultado_manual`: "corregida" o "no_eficaz"), con su evidencia.
    """
    if not es_verificacion_manual(tipo):
        return (
            EstadoSituacionPlan.NO_EFICAZ
            if sigue_presente
            else EstadoSituacionPlan.CORREGIDA
        )
    if resultado_manual not in (
        EstadoSituacionPlan.CORREGIDA.value,
        EstadoSituacionPlan.NO_EFICAZ.value,
    ):
        raise ValueError("El resultado de la verificación debe ser 'corregida' o 'no_eficaz'.")
    return EstadoSituacionPlan(resultado_manual)


def verificacion_completa(estados: Iterable) -> bool:
    """Todas las situaciones del alcance tienen la verificación hecha."""
    valores = [_valor(e) for e in estados]
    permitidos = {e.value for e in ESTADOS_SITUACION_VERIFICADA}
    return bool(valores) and all(v in permitidos for v in valores)


def todas_no_eficaces(estados: Iterable) -> bool:
    valores = [_valor(e) for e in estados]
    return bool(valores) and all(v == EstadoSituacionPlan.NO_EFICAZ.value for v in valores)


def resultado_de_cierre(estados: Iterable) -> EstadoPlan:
    """Estado de cierre según el conjunto de situaciones.

    Todas eficaces → eficaz · ninguna → no eficaz · algunas → parcialmente eficaz.
    Se evalúa DESPUÉS de pasar las Corregidas a Eficaz.
    """
    valores = [_valor(e) for e in estados]
    if not valores:
        raise ValueError("Un plan sin situaciones no tiene resultado.")
    eficaces = sum(1 for v in valores if v == EstadoSituacionPlan.EFICAZ.value)
    if eficaces == len(valores):
        return EstadoPlan.CERRADO_EFICAZ
    if eficaces == 0:
        return EstadoPlan.CERRADO_NO_EFICAZ
    return EstadoPlan.CERRADO_PARCIAL


# ============================================================
# PERÍODO DE OBSERVACIÓN
# ============================================================

#: Mínimo del período de observación: la ventana de recurrencia del motor.
#: Más corto que eso, un plan podría resultar "eficaz" sin que haya cambiado
#: nada (si lo normal es que el problema se repita cada tantos días, hay que
#: observar al menos ese lapso).
DIAS_OBSERVACION_MINIMO = riesgo.DIAS_VENTANA_RECURRENCIA

#: Valor inicial para todos los tipos: coherente con la ventana de recurrencia.
DIAS_OBSERVACION_DEFECTO = riesgo.DIAS_VENTANA_RECURRENCIA


def dias_observacion_validos(dias: int) -> bool:
    return DIAS_OBSERVACION_MINIMO <= dias <= DIAS_OBSERVACION_MAXIMO


def fin_observacion(inicio: date, dias: int) -> date:
    return inicio + timedelta(days=dias)


def observacion_terminada(hoy: date, fin: date | None) -> bool:
    return fin is not None and hoy >= fin


# ============================================================
# VÍNCULO ENTRE LA SITUACIÓN Y LA NOTIFICACIÓN QUE LA MUESTRA
# ============================================================

PREFIJO_NOTIFICACION = "notificacion-"


def claves_de_notificacion(clave_situacion: str) -> list[str]:
    """Claves con las que puede figurar una situación en la tabla de
    notificaciones, por orden de preferencia.

    El historial de situaciones guarda la clave del motor
    (`notificacion-elem-5`), pero las notificaciones que vienen de las fuentes
    originales se persisten con su propio id (`elem-5`). Los incidentes, los
    checklists y los documentos usan la misma clave en los dos lados.
    """
    claves = [clave_situacion]
    if clave_situacion.startswith(PREFIJO_NOTIFICACION):
        claves.append(clave_situacion[len(PREFIJO_NOTIFICACION):])
    return claves


def coincide_con_clave(clave_situacion: str, clave_buscada: str) -> bool:
    """¿La clave que el frontend tiene de una alerta es la de esta situación?"""
    return clave_buscada in claves_de_notificacion(clave_situacion)
