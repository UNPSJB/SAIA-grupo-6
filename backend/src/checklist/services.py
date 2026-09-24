import logging
from datetime import date as date_, datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.Equipo.models import Equipo
from src.Equipo.services import obtener_equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.services import leer_tarea
from src.exceptions import NotFound
from src.checklist.exceptions import ChecklistFuturo, ChecklistInmutable

logger = logging.getLogger(__name__)


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


def obtener_o_crear_checklist(
    db: Session, equipo_id: int, fecha: Optional[date_] = None
) -> schemas.ChecklistResponse:
    obtener_equipo(db, equipo_id)
    fecha_consulta = fecha or date_.today()
    hoy = date_.today()

    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.equipo_id == equipo_id,
            models.Checklist.fecha == fecha_consulta,
        )
    )

    planes = _planes_activos(db, equipo_id)

    # Tareas activas de cada plan que corresponden a fecha_consulta según
    # su propia frecuencia (ya no la del plan).
    tareas_del_dia_por_plan: Dict[int, List[Tarea]] = {
        plan.id: [
            t
            for t in plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
        ]
        for plan in planes
    }

    # 1. Si no existe y no hay tareas configuradas para hoy: no se persiste nada
    if checklist is None and not any(tareas_del_dia_por_plan.values()):
        return schemas.ChecklistResponse(
            checklist_id=None,
            fecha=fecha_consulta,
            equipo_id=equipo_id,
            estado=None,
            observaciones=None,
            planes=[],
        )

    # 2. Si es fecha futura y no existe checklist previo: solo previsualización
    if checklist is None and fecha_consulta > hoy:
        planes_futuros = [
            schemas.ChecklistPlanItem(
                plan_id=p.id,
                plan_nombre=p.nombre,
                tareas=[
                    schemas.ChecklistTareaItem(
                        id=t.id,
                        registro_id=0,
                        nombre=t.nombre,
                        plan_limpieza_id=p.id,
                        completado=False,
                        fecha_completado=None,
                        usuario_id=None,
                        evidencia_url=None, # MODIFICACIÓN: Agregado para soportar fotos en futuros
                    )
                    for t in tareas_del_dia_por_plan[p.id]
                ],
            )
            for p in planes
            if tareas_del_dia_por_plan[p.id]
        ]
        return schemas.ChecklistResponse(
            checklist_id=None,
            fecha=fecha_consulta,
            equipo_id=equipo_id,
            estado=None,
            observaciones=None,
            planes=planes_futuros,
        )

    # 3. Si no existe para la fecha actual (o previa a registrar): crear cabecera y tareas
    if checklist is None:
        checklist = models.Checklist(
            equipo_id=equipo_id,
            fecha=fecha_consulta,
            estado=models.EstadoChecklist.ABIERTO,
        )
        db.add(checklist)
        db.flush()

        for plan in planes:
            for tarea in tareas_del_dia_por_plan[plan.id]:
                reg = models.RegistroTarea(
                    checklist_id=checklist.id,
                    tarea_id=tarea.id,
                    nombre_tarea_historico=tarea.nombre,
                    completado=False,
                )
                db.add(reg)

        db.commit()
        db.refresh(checklist)
    else:
        # Si el checklist ya existía y es del día actual, incorporamos tareas nuevas si se agregaron hoy al plan
        if fecha_consulta == hoy:
            registros_por_tarea = {r.tarea_id: r for r in checklist.registros if r.tarea_id is not None}
            hay_nuevas = False
            for plan in planes:
                for tarea in tareas_del_dia_por_plan[plan.id]:
                    if tarea.id not in registros_por_tarea:
                        nuevo_reg = models.RegistroTarea(
                            checklist_id=checklist.id,
                            tarea_id=tarea.id,
                            nombre_tarea_historico=tarea.nombre,
                            completado=False,
                        )
                        db.add(nuevo_reg)
                        hay_nuevas = True
            if hay_nuevas:
                db.commit()
                db.refresh(checklist)

    # 3.5. Si el checklist quedó "atrás" en el tiempo, se cierra como dato
    # histórico. Cubre tanto el que ya existía como el recién creado en el
    # punto 3 (por ejemplo, la primera vez que se consulta una fecha pasada
    # que nunca se había abierto desde el frontend).
    if _cerrar_checklist_vencido(checklist, hoy):
        db.commit()
        db.refresh(checklist)

    # 4. ARMADO DE RESPUESTA BASADO EN LOS REGISTROS REALES DEL CHECKLIST
    # Agrupamos los registros físicos existentes por plan
    planes_dict = {}

    for reg in checklist.registros:
        # Si la tarea aún tiene su plan asociado, usamos sus datos; si fue reasignada/eliminada, mantenemos el histórico
        if reg.tarea and reg.tarea.plan:
            plan_id = reg.tarea.plan.id
            plan_nombre = reg.tarea.plan.nombre
        else:
            plan_id = 0
            plan_nombre = "Plan original"

        if plan_id not in planes_dict:
            planes_dict[plan_id] = {
                "plan_id": plan_id,
                "plan_nombre": plan_nombre,
                "tareas": [],
            }

        planes_dict[plan_id]["tareas"].append(
            schemas.ChecklistTareaItem(
                id=reg.tarea_id if reg.tarea_id is not None else 0,
                registro_id=reg.id,
                nombre=reg.nombre_tarea_historico,
                plan_limpieza_id=plan_id,
                completado=reg.completado,
                fecha_completado=reg.fecha_completado,
                usuario_id=reg.usuario_id,
                evidencia_url=reg.evidencia_url, # MODIFICACIÓN: Agregada la foto a la respuesta real
            )
        )

    planes_response = [
        schemas.ChecklistPlanItem(
            plan_id=p["plan_id"],
            plan_nombre=p["plan_nombre"],
            tareas=p["tareas"],
        )
        for p in planes_dict.values()
    ]

    return schemas.ChecklistResponse(
        checklist_id=checklist.id,
        fecha=checklist.fecha,
        equipo_id=checklist.equipo_id,
        estado=checklist.estado,
        observaciones=checklist.observaciones,
        planes=planes_response,
    )


def listar_tareas_del_dia(
    db: Session, fecha: Optional[date_] = None
) -> schemas.TareasDelDiaResponse:
    """Devuelve, en una lista plana, las tareas de todos los equipos activos
    para una fecha, junto con el nombre del plan al que pertenecen.

    Reemplaza al patrón anterior de pedirle al frontend que llame a
    /checklist/hoy una vez por equipo: acá se resuelve todo en un puñado de
    queries (no una por equipo) y una sola transacción.
    """
    fecha_consulta = fecha or date_.today()
    hoy = date_.today()

    equipos = db.scalars(select(Equipo).where(Equipo.activo == True)).all()
    if not equipos:
        return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=[])

    equipo_ids = [e.id for e in equipos]
    nombres_equipo = {e.id: e.nombre for e in equipos}

    checklists_existentes = {
        c.equipo_id: c
        for c in db.scalars(
            select(models.Checklist)
            .options(selectinload(models.Checklist.registros))
            .where(
                models.Checklist.equipo_id.in_(equipo_ids),
                models.Checklist.fecha == fecha_consulta,
            )
        ).all()
    }

    planes_por_equipo = _planes_activos_por_equipo(db, equipo_ids)

    items: List[schemas.TareaDelDiaItem] = []
    hay_cambios = False

    for equipo_id in equipo_ids:
        checklist = checklists_existentes.get(equipo_id)
        planes = planes_por_equipo[equipo_id]
        equipo_tiene_cambios = False
        tareas_del_dia_por_plan: Dict[int, List[Tarea]] = {
            plan.id: [
                t
                for t in plan.tareas
                if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
            ]
            for plan in planes
        }

        if checklist is None and not any(tareas_del_dia_por_plan.values()):
            continue

        if checklist is None and fecha_consulta > hoy:
            # Fecha futura sin checklist real todavía: solo previsualización, no se persiste nada.
            for plan in planes:
                for tarea in tareas_del_dia_por_plan[plan.id]:
                    items.append(
                        schemas.TareaDelDiaItem(
                            id=tarea.id,
                            registro_id=0,
                            nombre=tarea.nombre,
                            plan_id=plan.id,
                            plan_nombre=plan.nombre,
                            equipo_id=equipo_id,
                            equipo_nombre=nombres_equipo[equipo_id],
                            completado=False,
                            fecha_completado=None,
                            usuario_id=None,
                        )
                    )
            continue

        if checklist is None:
            checklist = models.Checklist(
                equipo_id=equipo_id,
                fecha=fecha_consulta,
                estado=models.EstadoChecklist.ABIERTO,
            )
            db.add(checklist)
            db.flush()
            for plan in planes:
                for tarea in tareas_del_dia_por_plan[plan.id]:
                    db.add(
                        models.RegistroTarea(
                            checklist_id=checklist.id,
                            tarea_id=tarea.id,
                            nombre_tarea_historico=tarea.nombre,
                            completado=False,
                        )
                    )
            equipo_tiene_cambios = True
        elif fecha_consulta == hoy:
            # Checklist ya existente: incorporamos tareas nuevas si se agregaron hoy al plan.
            registros_por_tarea = {
                r.tarea_id: r for r in checklist.registros if r.tarea_id is not None
            }
            for plan in planes:
                for tarea in tareas_del_dia_por_plan[plan.id]:
                    if tarea.id not in registros_por_tarea:
                        db.add(
                            models.RegistroTarea(
                                checklist_id=checklist.id,
                                tarea_id=tarea.id,
                                nombre_tarea_historico=tarea.nombre,
                                completado=False,
                            )
                        )
                        equipo_tiene_cambios = True

        if _cerrar_checklist_vencido(checklist, hoy):
            equipo_tiene_cambios = True

        if equipo_tiene_cambios:
            db.flush()
            db.refresh(checklist)
            hay_cambios = True

        for reg in checklist.registros:
            if reg.tarea and reg.tarea.plan:
                # Nombre del plan: el actual, aunque el plan haya sido
                # reasignado a otro equipo después de crear este checklist.
                plan_id, plan_nombre = reg.tarea.plan.id, reg.tarea.plan.nombre
            else:
                # La tarea original fue eliminada o desvinculada de su plan:
                # no fingimos que pertenece a un plan real (id=0 era engañoso).
                plan_id, plan_nombre = None, "Tarea eliminada del plan"

            items.append(
                schemas.TareaDelDiaItem(
                    id=reg.tarea_id if reg.tarea_id is not None else 0,
                    registro_id=reg.id,
                    nombre=reg.nombre_tarea_historico,
                    plan_id=plan_id,
                    plan_nombre=plan_nombre,
                    equipo_id=equipo_id,
                    equipo_nombre=nombres_equipo[equipo_id],
                    completado=reg.completado,
                    fecha_completado=reg.fecha_completado,
                    usuario_id=reg.usuario_id,
                    evidencia_url=reg.evidencia_url,
                    checklist_estado=checklist.estado,
                )
            )
    if hay_cambios:
        db.commit()

    return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=items)


def marcar_tarea(
    db: Session, 
    tarea_id: int, 
    completado: bool, 
    usuario_id: Optional[int], 
    evidencia_url: Optional[str], 
    fecha: Optional[date_] = None
) -> models.RegistroTarea:
    
    tarea = leer_tarea(db, tarea_id)
    fecha_registro = fecha or date_.today()
    hoy = date_.today()

    if fecha_registro > hoy:
        raise ChecklistFuturo()

    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.equipo_id == tarea.plan.equipo_id,
            models.Checklist.fecha == fecha_registro,
        )
    )

    if checklist is None:
        obtener_o_crear_checklist(db, tarea.plan.equipo_id, fecha_registro)
        checklist = db.scalar(
            select(models.Checklist).where(
                models.Checklist.equipo_id == tarea.plan.equipo_id,
                models.Checklist.fecha == fecha_registro,
            )
        )

    if checklist is not None and checklist.fecha < hoy:
        if _cerrar_checklist_vencido(checklist, hoy):
            db.commit()
        raise ChecklistInmutable()

    registro = db.scalar(
        select(models.RegistroTarea).where(
            models.RegistroTarea.checklist_id == checklist.id,
            models.RegistroTarea.tarea_id == tarea.id,
        )
    )

    if registro is None:
        registro = models.RegistroTarea(
            checklist_id=checklist.id,
            tarea_id=tarea.id,
            nombre_tarea_historico=tarea.nombre,
        )
        db.add(registro)
        db.flush()

    registro.completado = completado
    registro.fecha_completado = datetime.now() if completado else None
    registro.usuario_id = usuario_id
    if evidencia_url:
        registro.evidencia_url = evidencia_url

    # Auditoría: se agrega un evento nuevo, nunca se pisa nada. Esta fila
    # queda fija en el tiempo aunque el estado "actual" de arriba
    # (registro.completado, etc.) se vuelva a sobrescribir después.
    db.add(
        models.HistorialRegistroTarea(
            registro_tarea_id=registro.id,
            completado=completado,
            usuario_id=usuario_id,
            evidencia_url=evidencia_url,
        )
    )

    total = len(checklist.registros)
    completadas = sum(
        1 for r in checklist.registros
        if (r.id != registro.id and r.completado) or (r.id == registro.id and completado)
    )
    checklist.estado = models.EstadoChecklist.COMPLETO if (total > 0 and completadas == total) else models.EstadoChecklist.ABIERTO

    db.commit()
    db.refresh(registro)
    return registro


def obtener_historial_registro(db: Session, registro_id: int) -> schemas.HistorialRegistroTareaResponse:
    registro = db.get(models.RegistroTarea, registro_id)
    if registro is None:
        raise NotFound()

    eventos = db.scalars(
        select(models.HistorialRegistroTarea)
        .where(models.HistorialRegistroTarea.registro_tarea_id == registro_id)
        .order_by(models.HistorialRegistroTarea.fecha_evento)
    ).all()

    return schemas.HistorialRegistroTareaResponse(
        registro_id=registro_id,
        eventos=[schemas.HistorialRegistroTareaItem.model_validate(e) for e in eventos],
    )