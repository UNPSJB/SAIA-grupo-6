from datetime import date as date_
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.common.fechas import hoy
from src.Equipo.services import obtener_equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea


def _cerrar_checklist_vencido(checklist: models.Checklist, hoy: date_) -> bool:
    """Si el checklist corresponde a un día anterior a hoy, lo marca como
    CERRADO (dato histórico). Devuelve True si hubo que cambiarle el
    estado en esta llamada, para que el caller decida si commitea.

    No borra ni toca nada de sus registros: la inmutabilidad de los
    registro_tareas se hace cumplir en marcar_tarea, rechazando cualquier
    intento de escritura sobre un checklist ya cerrado.
    """
    if checklist.fecha < hoy and checklist.estado != models.EstadoChecklist.CERRADO:
        checklist.estado = models.EstadoChecklist.CERRADO
        return True
    return False


def _tarea_corresponde_a_la_fecha(tarea: Tarea, fecha: date_) -> bool:
    """La frecuencia es propia de cada tarea; el día 0 sigue siendo la
    fecha de creación del plan al que pertenece la tarea."""
    dias_transcurridos = (fecha - tarea.plan.fecha_creacion.date()).days
    if dias_transcurridos < 0:
        return False
    return dias_transcurridos % tarea.frecuencia == 0


def _planes_activos(db: Session, equipo_id: int) -> List[PlanLimpieza]:
    return db.scalars(
        select(PlanLimpieza).where(
            PlanLimpieza.equipo_id == equipo_id,
            PlanLimpieza.activo == True,
        )
    ).all()


def _tareas_ya_fotografiadas_hoy(
    db: Session, tarea_ids: List[int], fecha: date_
) -> set:
    """Devuelve el subconjunto de tarea_ids que YA tienen un registro en
    algún checklist (de cualquier equipo) para esa fecha. Necesario porque
    un plan puede reasignarse a otro equipo en medio del día: sin este
    chequeo, la tarea quedaría fotografiada dos veces (una por equipo)."""
    if not tarea_ids:
        return set()
    return set(
        db.scalars(
            select(models.RegistroTarea.tarea_id)
            .join(models.Checklist, models.RegistroTarea.checklist_id == models.Checklist.id)
            .where(
                models.RegistroTarea.tarea_id.in_(tarea_ids),
                models.Checklist.fecha == fecha,
            )
        ).all()
    )


def _planes_activos_por_equipo(
    db: Session, equipo_ids: List[int]
) -> Dict[int, List[PlanLimpieza]]:
    """Igual que _planes_activos pero para varios equipos en una sola query,
    con las tareas de cada plan ya precargadas (evita N+1 al recorrerlas)."""
    planes = db.scalars(
        select(PlanLimpieza)
        .options(selectinload(PlanLimpieza.tareas))
        .where(
            PlanLimpieza.equipo_id.in_(equipo_ids),
            PlanLimpieza.activo == True,
        )
    ).all()

    resultado: Dict[int, List[PlanLimpieza]] = {equipo_id: [] for equipo_id in equipo_ids}
    for plan in planes:
        resultado[plan.equipo_id].append(plan)
    return resultado

def _obtener_o_crear_checklist_de_plan(
    db: Session,
    plan: PlanLimpieza,
    tareas_del_dia: List[Tarea],
    fecha_consulta: date_,
    hoy: date_,
) -> tuple[Optional[models.Checklist], bool]:
    """Busca o crea el checklist de UN plan puntual para una fecha.

    Devuelve (checklist, huso_cambios):
    - (None, False) si no hay checklist previo y no hay tareas para
      mostrar ese día (nada que persistir).
    - (None, False) si la fecha es futura y no hay checklist previo: el
      caller arma su propia previsualización sin persistir nada.
    - (None, False) si la fecha es pasada y no hay checklist previo: no se
      genera en GET.
    - (checklist, changed) en cualquier otro caso, donde `changed` indica
      si hubo que crear el checklist o cerrarlo por vencido (para que el
      caller decida cuándo hacer commit).
    """
    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.plan_id == plan.id,
            models.Checklist.fecha == fecha_consulta,
        )
    )

    if checklist is None and not tareas_del_dia:
        return None, False
    if checklist is None and fecha_consulta > hoy:
        return None, False
    if checklist is None and fecha_consulta < hoy:
        # No crear checklists para días pasados en lectura
        return None, False
    changed = False

    if checklist is None:
        try:
            with db.begin_nested():
                checklist = models.Checklist(
                    equipo_id=plan.equipo_id,
                    plan_id=plan.id,
                    fecha=fecha_consulta,
                    estado=models.EstadoChecklist.ABIERTO,
                )
                db.add(checklist)
                db.flush()
                ids_candidatos = [t.id for t in tareas_del_dia]
                ya_fotografiadas = _tareas_ya_fotografiadas_hoy(db, ids_candidatos, fecha_consulta)

                for tarea in tareas_del_dia:
                    if tarea.id in ya_fotografiadas:
                        # Ya tiene registro bajo otro checklist de hoy (p. ej. el
                        # plan se reasignó de equipo a mitad del día): no se le
                        # toma una segunda foto.
                        continue
                    db.add(models.RegistroTarea(
                        checklist_id=checklist.id,
                        tarea_id=tarea.id,
                        nombre_tarea_historico=tarea.nombre,
                        descripcion_tarea_historico=tarea.descripcion,
                        tipo_tarea_historico=tarea.tipo,
                        observaciones_tarea_historico=tarea.observaciones,
                        completado=False,
                        operador_id=tarea.operador_id,
                    ))
                db.flush()
        except IntegrityError:
            # Conflicto por uq_checklist_plan_fecha: otra transacción lo creó
            # concurrentemente. El savepoint se deshizo solo; re-leemos el
            # checklist existente sin perder el resto de la transacción.
            checklist = db.scalar(
                select(models.Checklist).where(
                    models.Checklist.plan_id == plan.id,
                    models.Checklist.fecha == fecha_consulta,
                )
            )
            if checklist is None:
                return None, False
        changed = True
    # Si ya existía, NO se tocan sus registros acá: el checklist es una
    # foto tomada en el momento de su creación. Una tarea agregada al plan
    # después no se incorpora retroactivamente a esta checklist.

    if _cerrar_checklist_vencido(checklist, hoy):
        changed = True

    return checklist, changed

def obtener_o_crear_checklists_del_dia(
    db: Session, equipo_id: int, fecha: Optional[date_] = None
) -> List[schemas.ChecklistResponse]:
    """Devuelve los checklists del día para un equipo (solo lectura).

    No crea ni persiste nada. Si un plan no tiene checklist para la fecha
    consultada, se devuelve una vista calculada con las tareas del día
    (registro_id=0, completado=False) sin escribir en la base.
    """
    obtener_equipo(db, equipo_id)
    fecha_consulta = fecha or hoy()

    planes = _planes_activos(db, equipo_id)

    tareas_del_dia_por_plan: Dict[int, List[Tarea]] = {
        plan.id: [
            t for t in plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
        ]
        for plan in planes
    }

    # Lectura única de checklists existentes para todos los planes.
    plan_ids = [p.id for p in planes]
    checklists_existentes: Dict[int, models.Checklist] = {}
    if plan_ids:
        checklists_existentes = {
            c.plan_id: c
            for c in db.scalars(
                select(models.Checklist)
                .options(selectinload(models.Checklist.registros))
                .where(
                    models.Checklist.plan_id.in_(plan_ids),
                    models.Checklist.fecha == fecha_consulta,
                )
            ).all()
        }

    resultados: List[schemas.ChecklistResponse] = []

    for plan in planes:
        tareas_del_dia = tareas_del_dia_por_plan[plan.id]
        checklist = checklists_existentes.get(plan.id)

        if checklist is None:
            if not tareas_del_dia:
                # No hay tareas para mostrar y no hay checklist previo.
                continue
            # Vista calculada sin persistencia.
            resultados.append(schemas.ChecklistResponse(
                checklist_id=None,
                fecha=fecha_consulta,
                equipo_id=equipo_id,
                plan_id=plan.id,
                plan_nombre=plan.nombre,
                estado=None,
                observaciones=None,
                tareas=[
                    schemas.ChecklistTareaItem(
                        id=t.id,
                        registro_id=0,
                        nombre=t.nombre,
                        plan_limpieza_id=plan.id,
                        completado=False,
                        fecha_completado=None,
                        usuario_id=None,
                        evidencia_url=None,
                        descripcion=t.descripcion,
                        tipo=t.tipo,
                        observaciones=t.observaciones,
                        elemento_limpieza_id=None,
                    )
                    for t in tareas_del_dia
                ],
            ))
            continue

        resultados.append(schemas.ChecklistResponse(
            checklist_id=checklist.id,
            fecha=checklist.fecha,
            equipo_id=checklist.equipo_id,
            plan_id=plan.id,
            plan_nombre=plan.nombre,
            estado=checklist.estado,
            observaciones=checklist.observaciones,
            tareas=[
                schemas.ChecklistTareaItem(
                    id=reg.tarea_id if reg.tarea_id is not None else 0,
                    registro_id=reg.id,
                    nombre=reg.nombre_tarea_historico,
                    plan_limpieza_id=plan.id,
                    completado=reg.completado,
                    fecha_completado=reg.fecha_completado,
                    usuario_id=reg.usuario_id,
                    evidencia_url=reg.evidencia_url,
                    insumo_quimico_id=reg.insumo_quimico_id,
                    cantidad_consumida=reg.cantidad_consumida,
                    elemento_limpieza_id=reg.elemento_limpieza_id,
                    descripcion=reg.descripcion_tarea_historico,
                    tipo=reg.tipo_tarea_historico,
                    observaciones=reg.observaciones_tarea_historico,
                )
                for reg in checklist.registros
            ],
        ))

    return resultados
