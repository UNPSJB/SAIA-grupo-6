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

    Si un plan activo no tiene checklist para la fecha consultada:
      * hoy: se crea (con sus registros), para que las tareas se puedan marcar;
      * una fecha futura: se devuelve una vista calculada con las tareas que
        tocan según los planes actuales (registro_id=0, completado=False), sin
        escribir en la base;
      * una fecha pasada: no se devuelve nada. Lo que se muestra de un día
        pasado es solo lo que quedó registrado; reconstruirlo con los planes de
        hoy daría tareas que ese día no existían o con otra frecuencia, y que
        los indicadores no cuentan.

    Un checklist que ya existe para la fecha se muestra entero aunque después
    se haya desactivado su plan o su equipo: esas tareas ya eran del día. La
    desactivación rige desde el día siguiente, cuando el plan deja de generar
    checklist.
    """
    fecha_consulta = fecha or hoy()
    hoy_val = hoy()

    equipos = db.scalars(select(Equipo).where(Equipo.activo == True)).all()
    equipo_ids = [e.id for e in equipos]
    nombres_equipo = {e.id: e.nombre for e in equipos}

    planes_por_equipo = _planes_activos_por_equipo(db, equipo_ids) if equipo_ids else {}

    # Lectura única de los checklists ya creados para la fecha, de cualquier
    # plan: los de planes o equipos desactivados también se muestran.
    checklists_existentes: Dict[int, models.Checklist] = {
        c.plan_id: c
        for c in db.scalars(
            select(models.Checklist)
            .options(
                selectinload(models.Checklist.plan),
                selectinload(models.Checklist.equipo),
                selectinload(models.Checklist.registros).selectinload(
                    models.RegistroTarea.operador
                ),
                selectinload(models.Checklist.registros).selectinload(
                    models.RegistroTarea.reemplazado_por
                ),
            )
            .where(models.Checklist.fecha == fecha_consulta)
            .order_by(models.Checklist.equipo_id, models.Checklist.plan_id)
        ).all()
    }

    items: List[schemas.TareaDelDiaItem] = []
    planes_recorridos: set[int] = set()

    es_operador_simple = (
        current_user is not None
        and current_user.puede_operar
        and not current_user.puede_administrar
        and not current_user.es_super_admin
    )

    for equipo_id in equipo_ids:
        planes = planes_por_equipo[equipo_id]
        for plan in planes:
            planes_recorridos.add(plan.id)
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
                elif fecha_consulta < hoy_val:
                    # Día pasado sin checklist: no quedó nada registrado.
                    continue
                else:
                    # Vista calculada sin persistencia para fechas futuras.
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
                        ))
                    continue

            items.extend(
                _items_del_checklist(
                    checklist, plan.nombre, nombres_equipo[equipo_id],
                    current_user if es_operador_simple else None, hoy_val,
                )
            )

    # Checklists ya creados cuyo plan o equipo se desactivó después.
    for plan_id, checklist in checklists_existentes.items():
        if plan_id in planes_recorridos:
            continue
        items.extend(
            _items_del_checklist(
                checklist, checklist.plan.nombre, checklist.equipo.nombre,
                current_user if es_operador_simple else None, hoy_val,
            )
        )

    # Persistir los checklists de hoy que se hayan creado en esta consulta.
    db.commit()

    return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=items)


def _nombre(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _items_del_checklist(
    checklist: models.Checklist,
    plan_nombre: str,
    equipo_nombre: str,
    solo_de: Optional[Personal],
    hoy_val: date_,
) -> List[schemas.TareaDelDiaItem]:
    """Las tareas de un checklist ya creado. Con `solo_de` (un operador) se
    quedan las suyas, las que cubre como suplente y las sin asignar."""
    items: List[schemas.TareaDelDiaItem] = []
    for reg in checklist.registros:
        if solo_de is not None and not (
            reg.operador_id is None
            or reg.operador_id == solo_de.id
            or reg.reemplazado_por_id == solo_de.id
        ):
            continue

        items.append(schemas.TareaDelDiaItem(
            id=reg.tarea_id if reg.tarea_id is not None else 0,
            registro_id=reg.id,
            nombre=reg.nombre_tarea_historico,
            plan_id=checklist.plan_id,
            plan_nombre=plan_nombre,
            equipo_id=checklist.equipo_id,
            equipo_nombre=equipo_nombre,
            completado=reg.completado,
            fecha_completado=reg.fecha_completado,
            usuario_id=reg.usuario_id,
            evidencia_url=reg.evidencia_url,
            consumos=[
                schemas.ConsumoTareaItem(insumo_quimico_id=c.insumo_quimico_id, cantidad=c.cantidad)
                for c in reg.consumos
            ],
            elementos_limpieza_ids=reg.elementos_limpieza_ids,
            # Un día pasado que nadie volvió a tocar sigue guardado como
            # ABIERTO (el cierre se aplica recién al intentar escribir). Si se
            # mandaba tal cual, el frontend dejaba marcar la tarea, el backend
            # lo rechazaba y la barra de avance subía y bajaba. Se muestra
            # CERRADO, igual que en el historial.
            checklist_estado=_estado_a_mostrar(checklist, hoy_val),
            descripcion=reg.descripcion_tarea_historico,
            tipo=reg.tipo_tarea_historico,
            observaciones=reg.observaciones_tarea_historico,
            operador_id=reg.operador_id,
            operador_nombre=_nombre(reg.operador),
            reemplazado_por_id=reg.reemplazado_por_id,
            reemplazado_por_nombre=_nombre(reg.reemplazado_por),
        ))
    return items
