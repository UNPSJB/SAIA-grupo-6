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

from src.planes_accion.models import PlanAccion, SituacionPlan
from src.planes_accion.reglas import ESTADOS_PLAN_QUE_CONTROLAN, ESTADOS_SITUACION_CONTROLADA


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
