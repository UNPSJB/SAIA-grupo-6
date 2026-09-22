import logging
from datetime import date as date_, datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.checklist import models, schemas
from src.Equipo.services import obtener_equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.services import leer_tarea
from src.exceptions import NotFound

logger = logging.getLogger(__name__)


def _plan_corresponde_a_la_fecha(plan: PlanLimpieza, fecha: date_) -> bool:
    dias_transcurridos = (fecha - plan.fecha_creacion.date()).days
    if dias_transcurridos < 0:
        return False
    return dias_transcurridos % plan.frecuencia == 0


def _planes_del_dia(db: Session, equipo_id: int, fecha: date_) -> List[PlanLimpieza]:
    planes_activos = db.scalars(
        select(PlanLimpieza).where(
            PlanLimpieza.equipo_id == equipo_id,
            PlanLimpieza.activo == True,
        )
    ).all()
    return [p for p in planes_activos if _plan_corresponde_a_la_fecha(p, fecha)]


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

    planes = _planes_del_dia(db, equipo_id, fecha_consulta)

    # 1. Si no existe y no hay planes configurados para hoy: no se persiste nada
    if checklist is None and not planes:
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
                    )
                    for t in p.tareas
                    if t.activo
                ],
            )
            for p in planes
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
            for tarea in plan.tareas:
                if tarea.activo:
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
                for tarea in plan.tareas:
                    if tarea.activo and tarea.id not in registros_por_tarea:
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


def marcar_tarea(
    db: Session, tarea_id: int, datos: schemas.RegistroTareaUpdate, fecha: Optional[date_] = None
) -> models.RegistroTarea:
    tarea = leer_tarea(db, tarea_id)
    fecha_registro = fecha or date_.today()

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

    registro.completado = datos.completado
    registro.fecha_completado = datetime.now() if datos.completado else None
    registro.usuario_id = datos.usuario_id

    # Actualizar estado de la cabecera automáticamente si se completan todas
    total = len(checklist.registros)
    completadas = sum(1 for r in checklist.registros if (r.id != registro.id and r.completado) or (r.id == registro.id and datos.completado))
    checklist.estado = models.EstadoChecklist.COMPLETO if (total > 0 and completadas == total) else models.EstadoChecklist.ABIERTO

    db.commit()
    db.refresh(registro)
    return registro