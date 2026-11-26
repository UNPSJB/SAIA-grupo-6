"""Qué situaciones tiene bajo control un plan de acción verificado.

Lo consulta el motor de riesgo (`notificaciones.criticidad`) al evaluar cada
situación. Es de solo lectura, y el motor solo MARCA esas situaciones: su
riesgo real (impacto, recurrencia, persistencia, puntaje) no se toca. El riesgo
"tratado" es un cálculo aparte que deja afuera las situaciones controladas, y
el real queda siempre disponible para comparar la eficacia del plan.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.notificaciones import riesgo
from src.notificaciones.models import SituacionRiesgo
from src.planes_accion.models import PlanAccion, SituacionPlan
from src.planes_accion.reglas import (
    ESTADOS_ACTIVOS,
    ESTADOS_PLAN_QUE_CONTROLAN,
    ESTADOS_SITUACION_CONTROLADA,
)


def cobertura_activa(db: Session) -> tuple[dict[int, int], dict[tuple[str, str], int]]:
    """Qué cubre un plan ACTIVO (todavía sin cerrar ni cancelar).

    Devuelve:
    - id de la situación -> id del plan que la tiene en su alcance;
    - (familia, elemento) -> id del plan, para las situaciones que detecta el
      motor: un plan que trata "documento próximo a vencer" también cubre el
      "documento vencido" del mismo documento, y uno que trata el checklist
      incumplido de un equipo cubre los días siguientes del mismo equipo. Los
      incidentes no: cada uno se suma al plan o tiene el suyo.
    """
    filas = db.execute(
        select(
            SituacionPlan.situacion_id,
            SituacionPlan.plan_id,
            SituacionRiesgo.tipo,
            SituacionRiesgo.elemento,
        )
        .join(PlanAccion, PlanAccion.id == SituacionPlan.plan_id)
        .join(SituacionRiesgo, SituacionRiesgo.id == SituacionPlan.situacion_id)
        .where(PlanAccion.estado.in_(sorted(e.value for e in ESTADOS_ACTIVOS)))
        .order_by(SituacionPlan.id)
    )
    por_situacion: dict[int, int] = {}
    por_familia: dict[tuple[str, str], int] = {}
    for situacion_id, plan_id, tipo, elemento in filas:
        por_situacion.setdefault(situacion_id, plan_id)
        if tipo not in riesgo.TIPOS_DE_INCIDENTE:
            por_familia.setdefault((riesgo.familia(tipo), elemento), plan_id)
    return por_situacion, por_familia


def plan_activo_de(
    cobertura: tuple[dict[int, int], dict[tuple[str, str], int]],
    situacion_id: int,
    tipo: str,
    elemento: str,
) -> int | None:
    """El plan activo que cubre una situación, o None."""
    por_situacion, por_familia = cobertura
    if situacion_id in por_situacion:
        return por_situacion[situacion_id]
    if tipo in riesgo.TIPOS_DE_INCIDENTE:
        return None
    return por_familia.get((riesgo.familia(tipo), elemento))


def situaciones_controladas(db: Session) -> dict[int, int]:
    """Id de la situación de riesgo -> id del plan que la tiene bajo control.

    Una situación está controlada cuando su plan sigue en pie (Implementado, En
    verificación, o cerrado con al menos una situación eficaz) y la situación
    ya fue verificada: Corregida o Eficaz.
    """
    filas = db.execute(
        select(SituacionPlan.situacion_id, SituacionPlan.plan_id)
        .join(PlanAccion, PlanAccion.id == SituacionPlan.plan_id)
        .where(
            PlanAccion.estado.in_(sorted(e.value for e in ESTADOS_PLAN_QUE_CONTROLAN)),
            SituacionPlan.estado.in_(sorted(e.value for e in ESTADOS_SITUACION_CONTROLADA)),
        )
        .order_by(SituacionPlan.id)
    )
    return {situacion_id: plan_id for situacion_id, plan_id in filas}
