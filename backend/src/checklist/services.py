import logging
from datetime import date as date_, datetime
from typing import Dict, List, Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.Equipo.models import Equipo
from src.Equipo.services import obtener_equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.services import leer_tarea
from src.exceptions import NotFound
from src.checklist.exceptions import (
    CantidadConsumidaInvalida,
    ChecklistFuturo,
    ChecklistInmutable,
)
from src.insumoQuimico.models import InsumoQuimico
from src.elementoLimpieza.models import ElementoLimpieza

from src.checklist.constants import ErrorCode
from src.checklist.exceptions import FechaInvalida

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
    changed = False

    if checklist is None:
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
                completado=False,
            ))
        db.flush()
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
    obtener_equipo(db, equipo_id)
    fecha_consulta = fecha or date_.today()
    hoy = date_.today()

    planes = _planes_activos(db, equipo_id)

    tareas_del_dia_por_plan: Dict[int, List[Tarea]] = {
        plan.id: [
            t for t in plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
        ]
        for plan in planes
    }

    resultados: List[schemas.ChecklistResponse] = []
    hay_cambios = False
    
    for plan in planes:
        tareas_del_dia = tareas_del_dia_por_plan[plan.id]
        checklist, changed = _obtener_o_crear_checklist_de_plan(
            db, plan, tareas_del_dia, fecha_consulta, hoy
        )
        hay_cambios = hay_cambios or changed

        if checklist is None:
            if not tareas_del_dia:
                continue
            # Fecha futura sin checklist previo: solo previsualización.
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
                )
                for reg in checklist.registros
            ],
        ))

    if hay_cambios:
        db.commit()

    return resultados




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

    planes_por_equipo = _planes_activos_por_equipo(db, equipo_ids)
    plan_ids = [p.id for planes in planes_por_equipo.values() for p in planes]

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
    

    } if plan_ids else {}

    items: List[schemas.TareaDelDiaItem] = []
    hay_cambios = False

    for equipo_id in equipo_ids:
        planes = planes_por_equipo[equipo_id]
        for plan in planes:
            tareas_del_dia = [
                t for t in plan.tareas
                if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_consulta)
            ]
            checklist_existente = checklists_existentes.get(plan.id)

            if checklist_existente is None and not tareas_del_dia:
                continue

            if checklist_existente is None and fecha_consulta > hoy:
                for tarea in tareas_del_dia:
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
                        elemento_limpieza_id=None,
                    ))
                continue

            checklist, changed = (
                (checklist_existente, False) if checklist_existente is not None
                else _obtener_o_crear_checklist_de_plan(db, plan, tareas_del_dia, fecha_consulta, hoy)
            )
            if checklist_existente is not None and _cerrar_checklist_vencido(checklist, hoy):
                changed = True
            if changed:
                db.flush()
                db.refresh(checklist)
                hay_cambios = True

            for reg in checklist.registros:
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
                    checklist_estado=checklist.estado,
                    descripcion=reg.descripcion_tarea_historico,
                ))
    if hay_cambios:
        db.commit()

    return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=items)


def marcar_tarea(
    db: Session,
    tarea_id: int,
    completado: bool,
    usuario_id: int,
    evidencia_url: Optional[str],
    fecha: Optional[date_] = None,
    insumo_quimico_id: Optional[int] = None,
    cantidad_consumida: Optional[float] = None,
    elemento_limpieza_id: Optional[int] = None,
) -> models.RegistroTarea:

    if cantidad_consumida is not None and cantidad_consumida <= 0:
        raise CantidadConsumidaInvalida()

    tarea = leer_tarea(db, tarea_id)
    fecha_registro = fecha or date_.today()
    hoy = date_.today()

    # No se pueden modificar checklists futuros
    if fecha_registro > hoy:
        raise ChecklistFuturo()

    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.plan_id == tarea.plan.id,
            models.Checklist.fecha == fecha_registro,
        )
    )

    # Si todavía no existe el checklist, lo creamos
    if checklist is None:
        tareas_del_dia = [
            t for t in tarea.plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_registro)
        ]
        checklist, _ = _obtener_o_crear_checklist_de_plan(
            db, tarea.plan, tareas_del_dia, fecha_registro, hoy
        )
        if checklist is not None:
            db.commit()

    if checklist is None:
        raise ChecklistFuturo()

    # Los checklists de días anteriores son históricos
    # y no se pueden modificar.
    if checklist.fecha < hoy:
        if _cerrar_checklist_vencido(checklist, hoy):
            db.commit()

        raise ChecklistInmutable()

    # Buscamos el registro correspondiente a esta tarea
    registro = db.scalar(
        select(models.RegistroTarea).where(
            models.RegistroTarea.checklist_id == checklist.id,
            models.RegistroTarea.tarea_id == tarea.id,
        )
    )

    # Si por algún motivo todavía no existe, lo creamos
    if registro is None:
        registro = models.RegistroTarea(
            checklist_id=checklist.id,
            tarea_id=tarea.id,
            nombre_tarea_historico=tarea.nombre,
            descripcion_tarea_historico=tarea.descripcion,
        )

        db.add(registro)

        # Necesitamos el ID antes de registrar el historial
        db.flush()

    # Actualizamos el estado de la tarea
    registro.completado = completado

    # La autoría y el timestamp solo se escriben al completar: al desmarcar no
    # se pisa quién la había hecho, así el registro conserva el autor real.
    if completado:
        registro.fecha_completado = datetime.now()
        registro.usuario_id = usuario_id

    if evidencia_url:
        registro.evidencia_url = evidencia_url

    # ---------------------------------------------------------
    # CONSUMO APROXIMADO DEL INSUMO QUÍMICO
    # ---------------------------------------------------------
    # El consumo se guarda directamente en RegistroTarea.
    # Ya no se maneja stock ni una tabla separada de consumos.
    if (
        completado
        and insumo_quimico_id is not None
        and cantidad_consumida is not None
    ):
        insumo = db.get(InsumoQuimico, insumo_quimico_id)
        if insumo is None or not insumo.activo:
            raise NotFound()
        registro.insumo_quimico_id = insumo_quimico_id
        registro.cantidad_consumida = cantidad_consumida
    else:
        # Si la tarea queda desmarcada o se completa sin producto químico,
        # no queda un consumo asociado al estado actual del registro.
        registro.insumo_quimico_id = None
        registro.cantidad_consumida = None
    # Registro del elemento de limpieza utilizado

    if completado and elemento_limpieza_id is not None:
        elemento = db.get(ElementoLimpieza, elemento_limpieza_id)
        if elemento is None or not elemento.activo:
            raise NotFound()
        registro.elemento_limpieza_id = elemento_limpieza_id
    elif not completado:
        registro.elemento_limpieza_id = None
    # ---------------------------------------------------------
    # AUDITORÍA
    # ---------------------------------------------------------
    # Se agrega un evento nuevo y nunca se pisa el historial.
    db.add(
        models.HistorialRegistroTarea(
            registro_tarea_id=registro.id,
            completado=completado,
            usuario_id=usuario_id,
            evidencia_url=evidencia_url,
        )
    )

    # ---------------------------------------------------------
    # ACTUALIZAMOS EL ESTADO GENERAL DEL CHECKLIST
    # ---------------------------------------------------------
    total = len(checklist.registros)

    completadas = sum(
        1
        for r in checklist.registros
        if (
            (r.id != registro.id and r.completado)
            or
            (r.id == registro.id and completado)
        )
    )

    checklist.estado = (
        models.EstadoChecklist.COMPLETO
        if total > 0 and completadas == total
        else models.EstadoChecklist.ABIERTO
    )

    # Un único commit guarda:
    # - estado de la tarea
    # - historial
    # - producto químico utilizado y cantidad aproximada consumida
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
        .options(selectinload(models.HistorialRegistroTarea.usuario))
        .order_by(models.HistorialRegistroTarea.fecha_evento)
    ).all()

    items = []
    for e in eventos:
        item = schemas.HistorialRegistroTareaItem.model_validate(e)
        if e.usuario is not None:
            item.usuario_nombre = f"{e.usuario.nombre} {e.usuario.apellido or ''}".strip()
        items.append(item)

    return schemas.HistorialRegistroTareaResponse(
        registro_id=registro_id,
        eventos=items,
    )

# ---------------------------------------------------------
    # ACTUALIZAMOS  para que muestres el historial 
    # ---------------------------------------------------------

def listar_historial_checklists(
    db: Session,
    fecha_desde: date_,
    fecha_hasta: date_,
    equipo_id: Optional[int] = None,
) -> schemas.HistorialChecklistResponse:
    if fecha_desde > fecha_hasta:
        raise FechaInvalida()

    query = (
        select(models.Checklist)
        .options(selectinload(models.Checklist.registros), selectinload(models.Checklist.equipo))
        .where(
            models.Checklist.fecha >= fecha_desde,
            models.Checklist.fecha <= fecha_hasta,
        )
    )
    if equipo_id is not None:
        query = query.where(models.Checklist.equipo_id == equipo_id)

    checklists = db.scalars(query.order_by(models.Checklist.fecha.desc())).all()

    items: List[schemas.HistorialChecklistItem] = []
    total_general = 0
    completadas_general = 0

    for cl in checklists:
        total = len(cl.registros)
        completadas = sum(1 for r in cl.registros if r.completado)
        incumplidas = [
            schemas.TareaIncumplidaItem(tarea_id=r.tarea_id, nombre=r.nombre_tarea_historico)
            for r in cl.registros
            if not r.completado
        ]
        total_general += total
        completadas_general += completadas

        items.append(
            schemas.HistorialChecklistItem(
                checklist_id=cl.id,
                fecha=cl.fecha,
                equipo_id=cl.equipo_id,
                equipo_nombre=cl.equipo.nombre,
                estado=cl.estado,
                total_tareas=total,
                tareas_completadas=completadas,
                porcentaje_cumplimiento=(completadas / total * 100) if total else 0.0,
                tareas_incumplidas=incumplidas,
            )
        )

    return schemas.HistorialChecklistResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        equipo_id=equipo_id,
        porcentaje_cumplimiento_general=(
            completadas_general / total_general * 100 if total_general else 0.0
        ),
        checklists=items,
    )


# ---------------------------------------------------------
# CONSUMO ACUMULADO DE PRODUCTOS DE LIMPIEZA
# ---------------------------------------------------------

def listar_consumo_insumos(
    db: Session,
    fecha_desde: date_,
    fecha_hasta: date_,
) -> schemas.ConsumoInsumosResponse:
    """Consumo acumulado por producto químico en un rango de fechas.

    Solo cuenta los registros que efectivamente tienen consumo informado y
    cuya tarea fue completada, para no arrastrar consumos de tareas que
    después se desmarcaron.
    """
    if fecha_desde > fecha_hasta:
        raise FechaInvalida()

    filas = db.execute(
        select(
            models.RegistroTarea.insumo_quimico_id.label("insumo_quimico_id"),
            models.Checklist.fecha.label("fecha"),
            func.sum(models.RegistroTarea.cantidad_consumida).label("cantidad_total"),
            func.count(models.RegistroTarea.id).label("cantidad_registros"),
        )
        .join(
            models.Checklist,
            models.Checklist.id == models.RegistroTarea.checklist_id,
        )
        .where(
            models.Checklist.fecha >= fecha_desde,
            models.Checklist.fecha <= fecha_hasta,
            models.RegistroTarea.insumo_quimico_id.isnot(None),
            models.RegistroTarea.cantidad_consumida.isnot(None),
            models.RegistroTarea.cantidad_consumida > 0,
            models.RegistroTarea.completado.is_(True),
        )
        .group_by(models.RegistroTarea.insumo_quimico_id, models.Checklist.fecha)
    ).all()

    # Acumulamos por producto y por fecha en un solo recorrido.
    por_insumo: Dict[int, Dict[str, object]] = {}
    por_fecha: Dict[date_, float] = {}

    for insumo_id, fecha, cantidad_total, cantidad_registros in filas:
        cantidad_total = float(cantidad_total or 0)
        cantidad_registros = int(cantidad_registros or 0)

        insumo = por_insumo.setdefault(
            insumo_id,
            {
                "nombre": None,
                "unidad_simbolo": None,
                "cantidad_total": 0.0,
                "cantidad_registros": 0,
            },
        )

        insumo["cantidad_total"] = float(insumo["cantidad_total"]) + cantidad_total
        insumo["cantidad_registros"] = int(insumo["cantidad_registros"]) + cantidad_registros

        por_fecha[fecha] = por_fecha.get(fecha, 0.0) + cantidad_total

    # Completamos nombre y unidad de cada producto con una sola consulta.
    ids = list(por_insumo.keys())
    nombres: Dict[int, tuple] = {}

    if ids:
        for insumo in db.scalars(
            select(InsumoQuimico).where(InsumoQuimico.id.in_(ids))
        ).all():
            simbolo = getattr(insumo.unidad_medida, "simbolo", None)
            nombres[insumo.id] = (insumo.nombre, simbolo)

    items: List[schemas.ConsumoInsumoItem] = []

    for insumo_id, datos in por_insumo.items():
        nombre, simbolo = nombres.get(insumo_id, (None, None))
        items.append(
            schemas.ConsumoInsumoItem(
                insumo_quimico_id=insumo_id,
                nombre=nombre or f"Insumo {insumo_id}",
                unidad_simbolo=simbolo,
                cantidad_total=round(float(datos["cantidad_total"]), 2),
                cantidad_registros=int(datos["cantidad_registros"]),
            )
        )

    items.sort(key=lambda i: i.cantidad_total, reverse=True)

    return schemas.ConsumoInsumosResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        total_general=round(sum(i.cantidad_total for i in items), 2),
        insumos=items,
        por_fecha=[
            schemas.ConsumoPorFechaItem(fecha=fecha, cantidad_total=round(total, 2))
            for fecha, total in sorted(por_fecha.items())
        ],
    )
