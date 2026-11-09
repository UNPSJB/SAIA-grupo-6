from datetime import date as date_
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.common.fechas import hoy
from src.Equipo.models import Equipo
from src.personal.models import Personal
from src.checklist.services.historial import _estado_a_mostrar
from src.checklist.services.generacion import (
    _obtener_o_crear_checklist_de_plan,
    _planes_activos_por_equipo,
    _tarea_corresponde_a_la_fecha,
)


def listar_tareas_del_dia(
    db: Session,
    fecha: Optional[date_] = None,
    current_user: Optional[Personal] = None,
) -> schemas.TareasDelDiaResponse:
    """Devuelve, en una lista plana, las tareas de todos los equipos activos
    para una fecha, junto con el nombre del plan al que pertenecen (solo lectura).

    Si `current_user` es un operador (sin permisos de administración), solo se
    devuelven las tareas que le están asignadas (operador_id == su id), las que
    cubre como suplente (reemplazado_por_id == su id) o las tareas sin asignar
    (operador_id IS NULL), para que pueda tomarlas.

    No crea ni persiste nada. Si un plan no tiene checklist para la fecha
    consultada, se devuelve una vista calculada con las tareas del día
    (registro_id=0, completado=False) sin escribir en la base.
    """
    fecha_consulta = fecha or hoy()
    hoy_val = hoy()

    equipos = db.scalars(select(Equipo).where(Equipo.activo == True)).all()
    if not equipos:
        return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=[])

    equipo_ids = [e.id for e in equipos]
    nombres_equipo = {e.id: e.nombre for e in equipos}

    planes_por_equipo = _planes_activos_por_equipo(db, equipo_ids)
    plan_ids = [p.id for planes in planes_por_equipo.values() for p in planes]

    # Lectura única de checklists existentes para todos los planes.
    checklists_existentes: Dict[int, models.Checklist] = {}
    if plan_ids:
        checklists_existentes = {
            c.plan_id: c
            for c in db.scalars(
                select(models.Checklist)
                .options(
                    selectinload(models.Checklist.registros),
                    selectinload(models.Checklist.registros).selectinload(
                        models.RegistroTarea.operador
                    ),
                    selectinload(models.Checklist.registros).selectinload(
                        models.RegistroTarea.reemplazado_por
                    ),
                )
                .where(
                    models.Checklist.plan_id.in_(plan_ids),
                    models.Checklist.fecha == fecha_consulta,
                )
            ).all()
        }

    items: List[schemas.TareaDelDiaItem] = []

    es_operador_simple = (
        current_user is not None
        and current_user.puede_operar
        and not current_user.puede_administrar
        and not current_user.es_super_admin
    )

    for equipo_id in equipo_ids:
        planes = planes_por_equipo[equipo_id]
        for plan in planes:
            tareas_del_dia = [
                t for t in plan.tareas
                if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
            ]
            checklist = checklists_existentes.get(plan.id)

            if checklist is None:
                if not tareas_del_dia:
                    continue
                # Si es hoy, crear el checklist (y sus registros) para que
                # las tareas puedan ser marcadas. Antes solo se devolvía una
                # vista previa con registro_id=0 y no se podía marcar nada.
                if fecha_consulta == hoy_val:
                    checklist, _ = _obtener_o_crear_checklist_de_plan(
                        db, plan, tareas_del_dia, fecha_consulta, hoy_val
                    )
                    if checklist is None:
                        continue
                    db.refresh(checklist, attribute_names=["registros"])
                else:
                    # Vista calculada sin persistencia para otros días.
                    for tarea in tareas_del_dia:
                        if es_operador_simple:
                            continue  # Las tareas sin checklist aún no tienen operador asignado
                        items.append(schemas.TareaDelDiaItem(
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
                            descripcion=tarea.descripcion,
                            tipo=tarea.tipo,
                            observaciones=tarea.observaciones,
                            elemento_limpieza_id=None,
                        ))
                    continue

            for reg in checklist.registros:
                operador = reg.operador
                reemplazado_por = reg.reemplazado_por

                # Filtro por operador: ve las suyas, las que cubre como
                # suplente y las sin asignar.
                if es_operador_simple:
                    es_suyo = (
                        reg.operador_id is None
                        or reg.operador_id == current_user.id
                        or reg.reemplazado_por_id == current_user.id
                    )
                    if not es_suyo:
                        continue

                items.append(schemas.TareaDelDiaItem(
                    id=reg.tarea_id if reg.tarea_id is not None else 0,
                    registro_id=reg.id,
                    nombre=reg.nombre_tarea_historico,
                    plan_id=plan.id,
                    plan_nombre=plan.nombre,
                    equipo_id=equipo_id,
                    equipo_nombre=nombres_equipo[equipo_id],
                    completado=reg.completado,
                    fecha_completado=reg.fecha_completado,
                    usuario_id=reg.usuario_id,
                    evidencia_url=reg.evidencia_url,
                    insumo_quimico_id=reg.insumo_quimico_id,
                    cantidad_consumida=reg.cantidad_consumida,
                    elemento_limpieza_id=reg.elemento_limpieza_id,
                    # Un día pasado que nadie volvió a tocar sigue guardado
                    # como ABIERTO (el cierre se aplica recién al intentar
                    # escribir). Si se mandaba tal cual, el frontend dejaba
                    # marcar la tarea, el backend lo rechazaba y la barra de
                    # avance subía y bajaba. Se muestra CERRADO, igual que en
                    # el historial.
                    checklist_estado=_estado_a_mostrar(checklist, hoy_val),
                    descripcion=reg.descripcion_tarea_historico,
                    tipo=reg.tipo_tarea_historico,
                    observaciones=reg.observaciones_tarea_historico,
                    operador_id=reg.operador_id,
                    operador_nombre=(
                        f"{operador.nombre} {operador.apellido or ''}".strip()
                        if operador is not None else None
                    ),
                    reemplazado_por_id=reg.reemplazado_por_id,
                    reemplazado_por_nombre=(
                        f"{reemplazado_por.nombre} {reemplazado_por.apellido or ''}".strip()
                        if reemplazado_por is not None else None
                    ),
                ))

    # Persistir los checklists de hoy que se hayan creado en esta consulta.
    db.commit()

    return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=items)
