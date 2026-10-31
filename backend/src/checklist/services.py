from datetime import date as date_, datetime
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import case, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.common.fechas import hoy, ahora
from src.common.listados import ColumnaOrden, aplicar_orden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.Equipo.models import Equipo
from src.Equipo.services import obtener_equipo
from src.PlanLimpieza.models import PlanLimpieza
from src.tareas.models import Tarea
from src.tareas.services import leer_tarea
from src.tareas.exceptions import TareaNoEncontrada
from src.checklist import exceptions
from src.checklist.exceptions import (
    ActualizacionConcurrente,
    CantidadConsumidaInvalida,
    ChecklistFuturo,
    ChecklistInmutable,
    TareaNoCorrespondeALaFecha,
)
from src.insumoQuimico.models import InsumoQuimico
from src.insumoQuimico.stock_services import sincronizar_consumo_checklist
from src.unidadMedida.models import UnidadMedida
from src.elementoLimpieza.models import ElementoLimpieza

from src.checklist.exceptions import FechaInvalida



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




def listar_tareas_del_dia(
    db: Session, fecha: Optional[date_] = None
) -> schemas.TareasDelDiaResponse:
    """Devuelve, en una lista plana, las tareas de todos los equipos activos
    para una fecha, junto con el nombre del plan al que pertenecen (solo lectura).

    No crea ni persiste nada. Si un plan no tiene checklist para la fecha
    consultada, se devuelve una vista calculada con las tareas del día
    (registro_id=0, completado=False) sin escribir en la base.
    """
    fecha_consulta = fecha or hoy()

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
                .options(selectinload(models.Checklist.registros))
                .where(
                    models.Checklist.plan_id.in_(plan_ids),
                    models.Checklist.fecha == fecha_consulta,
                )
            ).all()
        }

    items: List[schemas.TareaDelDiaItem] = []

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
                # Vista calculada sin persistencia.
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
                        tipo=tarea.tipo,
                        observaciones=tarea.observaciones,
                        elemento_limpieza_id=None,
                    ))
                continue

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
                    tipo=reg.tipo_tarea_historico,
                    observaciones=reg.observaciones_tarea_historico,
                ))

    return schemas.TareasDelDiaResponse(fecha=fecha_consulta, tareas=items)


def marcar_tarea(
    db: Session,
    tarea_id: int,
    completado: bool,
    usuario_id: int,
    usuario_nombre: str,
    evidencia_url: Optional[str],
    fecha: Optional[date_] = None,
    insumo_quimico_id: Optional[int] = None,
    cantidad_consumida: Optional[float] = None,
    elemento_limpieza_id: Optional[int] = None,
) -> models.RegistroTarea:

    if cantidad_consumida is not None and cantidad_consumida <= 0:
        raise CantidadConsumidaInvalida()
    if (insumo_quimico_id is None) != (cantidad_consumida is None):
        raise CantidadConsumidaInvalida()
    if completado and insumo_quimico_id is not None:
        insumo_validado = db.get(InsumoQuimico, insumo_quimico_id)
        if insumo_validado is None or not insumo_validado.activo:
            raise exceptions.InsumoQuimicoNoEncontrado()
    if completado and elemento_limpieza_id is not None:
        elemento_validado = db.get(ElementoLimpieza, elemento_limpieza_id)
        if elemento_validado is None or not elemento_validado.activo:
            raise exceptions.ElementoLimpiezaNoEncontrado()

    tarea = leer_tarea(db, tarea_id)
    if not tarea.activo or not tarea.plan.activo:
        raise TareaNoEncontrada()

    fecha_registro = fecha or hoy()
    hoy_val = hoy()

    # No se pueden modificar checklists futuros
    if fecha_registro > hoy_val:
        raise ChecklistFuturo()

    checklist = db.scalar(
        select(models.Checklist).where(
            models.Checklist.plan_id == tarea.plan.id,
            models.Checklist.fecha == fecha_registro,
        )
    )

    # Si todavía no existe el checklist, lo creamos
    if checklist is None:
        # Verificar que la tarea corresponde a la fecha solicitada
        if not _tarea_corresponde_a_la_fecha(tarea, fecha_registro):
            raise TareaNoCorrespondeALaFecha()
        tareas_del_dia = [
            t for t in tarea.plan.tareas
            if t.activo and _tarea_corresponde_a_la_fecha(t, fecha_registro)
        ]
        checklist, _ = _obtener_o_crear_checklist_de_plan(
            db, tarea.plan, tareas_del_dia, fecha_registro, hoy_val
        )
    if checklist is None:
        # Si la tarea no corresponde a la fecha, no se crea checklist
        raise TareaNoCorrespondeALaFecha()

    # Los checklists de días anteriores son históricos
    # y no se pueden modificar.
    if checklist.fecha < hoy_val:
        if _cerrar_checklist_vencido(checklist, hoy_val):
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
            tipo_tarea_historico=tarea.tipo,
            observaciones_tarea_historico=tarea.observaciones,
        )

        db.add(registro)

        # Necesitamos el ID antes de registrar el historial
        db.flush()

    consumo_anterior = (
        registro.insumo_quimico_id,
        Decimal(str(registro.cantidad_consumida)) if registro.cantidad_consumida is not None else None,
    )

    version_anterior = registro.version_stock
    resultado_version = db.execute(
        update(models.RegistroTarea)
        .where(
            models.RegistroTarea.id == registro.id,
            models.RegistroTarea.version_stock == version_anterior,
        )
        .values(version_stock=version_anterior + 1)
    )
    if resultado_version.rowcount != 1:
        db.rollback()
        raise ActualizacionConcurrente()
    registro.version_stock = version_anterior + 1

    # Actualizamos el estado de la tarea
    registro.completado = completado

    # La autoría y el timestamp solo se escriben al completar: al desmarcar no
    # se pisa quién la había hecho, así el registro conserva el autor real.
    if completado:
        registro.fecha_completado = ahora()
        registro.usuario_id = usuario_id
        if evidencia_url:
            registro.evidencia_url = evidencia_url
    else:
        registro.fecha_completado = None
        registro.evidencia_url = None

    # ---------------------------------------------------------
    # CONSUMO APROXIMADO DEL INSUMO QUÍMICO
    # ---------------------------------------------------------
    # El consumo se guarda directamente en RegistroTarea.
    # Ya no se maneja stock ni una tabla separada de consumos.
    if completado:
        # Si se envían datos de consumo, deben venir completos
        if insumo_quimico_id is not None or cantidad_consumida is not None:
            if insumo_quimico_id is None or cantidad_consumida is None:
                raise CantidadConsumidaInvalida()
            insumo = db.get(InsumoQuimico, insumo_quimico_id)
            if insumo is None or not insumo.activo:
                raise exceptions.InsumoQuimicoNoEncontrado()
            registro.insumo_quimico_id = insumo_quimico_id
            registro.cantidad_consumida = cantidad_consumida
        # Si no se envían datos de consumo y el registro ya tenía valores,
        # se mantienen (no se borran al completar sin enviar consumo).
        # Si no había valores, quedan como están (None).
    else:
        # Al desmarcar, se limpia el consumo asociado
        registro.insumo_quimico_id = None
        registro.cantidad_consumida = None
    # Registro del elemento de limpieza utilizado

    if completado and elemento_limpieza_id is not None:
        registro.elemento_limpieza_id = elemento_limpieza_id
    elif not completado:
        registro.elemento_limpieza_id = None

    consumo_nuevo = (
        registro.insumo_quimico_id,
        Decimal(str(registro.cantidad_consumida)) if registro.cantidad_consumida is not None else None,
    )

    # El descuento y su trazabilidad son parte de la misma unidad de trabajo
    # que el estado de la tarea. Un reintento idéntico no genera diferencia.
    try:
        sincronizar_consumo_checklist(
            db,
            registro_id=registro.id,
            checklist_id=checklist.id,
            checklist_fecha=checklist.fecha,
            tarea_nombre=registro.nombre_tarea_historico,
            consumo_anterior=consumo_anterior,
            consumo_nuevo=consumo_nuevo,
            usuario_id=usuario_id,
            usuario_nombre=usuario_nombre,
        )
    except Exception:
        db.rollback()
        raise
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
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(registro)

    return registro


def obtener_historial_registro(db: Session, registro_id: int) -> schemas.HistorialRegistroTareaResponse:
    registro = db.get(models.RegistroTarea, registro_id)
    if registro is None:
        raise exceptions.RegistroTareaNoEncontrado()

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

def _estado_a_mostrar(cl: models.Checklist, hoy: date_) -> models.EstadoChecklist:
    """Estado con el que se MUESTRA un checklist en lectura.

    `_cerrar_checklist_vencido` solo corre al abrir/marcar un día, así que un
    día pasado que nadie volvió a tocar queda guardado como ABIERTO o COMPLETO.
    La corrección es de lectura (un GET no escribe): fecha < hoy y estado
    ABIERTO o COMPLETO se muestra CERRADO. OBSERVADO se muestra tal cual.
    """
    if cl.fecha < hoy and cl.estado in (
        models.EstadoChecklist.ABIERTO,
        models.EstadoChecklist.COMPLETO,
    ):
        return models.EstadoChecklist.CERRADO
    return cl.estado


def _construir_item_historial(
    cl: models.Checklist, hoy: date_
) -> schemas.HistorialChecklistItem:
    """Arma el `HistorialChecklistItem` de un checklist.

    Requiere que `cl.registros` ya esté cargado (selectinload): contar y
    filtrar las tareas acá es barato porque son las del checklist solo.

    El estado con el que se muestra es el de `_estado_a_mostrar` (la misma
    regla que usa el detalle): corrige en lectura los días pasados que
    quedaron guardados como ABIERTO o COMPLETO, y deja el OBSERVADO tal
    cual (ver nota en `listar_historial_checklists`).
    """
    total = len(cl.registros)
    completadas = sum(1 for r in cl.registros if r.completado)
    incumplidas = [
        schemas.TareaIncumplidaItem(tarea_id=r.tarea_id, nombre=r.nombre_tarea_historico)
        for r in cl.registros
        if not r.completado
    ]

    return schemas.HistorialChecklistItem(
        checklist_id=cl.id,
        fecha=cl.fecha,
        equipo_id=cl.equipo_id,
        equipo_nombre=cl.equipo.nombre,
        estado=_estado_a_mostrar(cl, hoy),
        total_tareas=total,
        tareas_completadas=completadas,
        porcentaje_cumplimiento=(completadas / total * 100) if total else 0.0,
        tareas_incumplidas=incumplidas,
    )


def _porcentaje_cumplimiento_periodo(
    db: Session,
    fecha_desde: date_,
    fecha_hasta: date_,
    equipo_id: Optional[int],
    buscar: Optional[str] = None,
) -> float:
    """Cumplimiento de TODO el período, con un agregado en la base.

    COUNT de registros + SUM de completados unidos al checklist, con los
    MISMOS filtros de fecha, equipo y búsqueda del listado. Sin cargar objetos
    ORM: el porcentaje no depende de la página que se esté mirando, así que
    calcularlo recorriendo todos los checklists anularía la paginación.
    """
    consulta = (
        select(
            func.count(models.RegistroTarea.id),
            func.coalesce(
                func.sum(case((models.RegistroTarea.completado == True, 1), else_=0)), 0
            ),
        )
        .join(models.Checklist, models.RegistroTarea.checklist_id == models.Checklist.id)
        .join(Equipo, Equipo.id == models.Checklist.equipo_id)
        .where(
            models.Checklist.fecha >= fecha_desde,
            models.Checklist.fecha <= fecha_hasta,
        )
    )
    if equipo_id is not None:
        consulta = consulta.where(models.Checklist.equipo_id == equipo_id)

    filtro_texto = filtro_busqueda((Equipo.nombre,), buscar)
    if filtro_texto is not None:
        consulta = consulta.where(filtro_texto)

    total, completadas = db.execute(consulta).one()
    total = int(total or 0)
    completadas = int(completadas or 0)
    return (completadas / total * 100) if total else 0.0


_ORDENES_HISTORIAL = {
    "fecha_asc": ColumnaOrden((models.Checklist.fecha,)),
    "fecha_desc": ColumnaOrden((models.Checklist.fecha,), descendente=True),
    "equipo_asc": ColumnaOrden((sin_tildes(Equipo.nombre),)),
    "equipo_desc": ColumnaOrden((sin_tildes(Equipo.nombre),), descendente=True),
}


def _consulta_historial(
    fecha_desde: date_,
    fecha_hasta: date_,
    equipo_id: Optional[int],
    buscar: Optional[str],
):
    """Consulta base del historial, con los filtros como lista reutilizable.

    El join con `Equipo` es many-to-one por clave primaria: no duplica filas,
    y es lo que permite buscar y ordenar por nombre de equipo en SQL.
    """
    consulta = (
        select(models.Checklist)
        .join(Equipo, Equipo.id == models.Checklist.equipo_id)
        .options(
            selectinload(models.Checklist.registros),
            selectinload(models.Checklist.equipo),
        )
    )

    filtros = [
        models.Checklist.fecha >= fecha_desde,
        models.Checklist.fecha <= fecha_hasta,
    ]
    if equipo_id is not None:
        filtros.append(models.Checklist.equipo_id == equipo_id)

    filtro_texto = filtro_busqueda((Equipo.nombre,), buscar)
    if filtro_texto is not None:
        filtros.append(filtro_texto)

    return consulta, filtros


def listar_historial_checklists(
    db: Session,
    fecha_desde: date_,
    fecha_hasta: date_,
    equipo_id: Optional[int] = None,
    buscar: Optional[str] = None,
    orden: Optional[str] = None,
    page: Optional[int] = None,
    page_size: int = 10,
) -> schemas.HistorialChecklistResponse | schemas.HistorialChecklistPagina:
    """Historial de checklists de un rango, paginado en la BASE cuando
    `page` viene informado.

    Con `page`: COUNT + OFFSET/LIMIT sobre la consulta de `Checklist`
    (`paginar_consulta`), y el `selectinload` de registros se ejecuta solo
    sobre las filas de la página. El desempate por `id` lo agrega
    `aplicar_orden`: sin él, OFFSET/LIMIT puede repetir u omitir filas entre
    páginas. El cumplimiento general se calcula aparte con un agregado (ver
    `_porcentaje_cumplimiento_periodo`), con los mismos filtros.

    Sin `page`: comportamiento histórico intacto (lista completa del rango
    con el porcentaje calculado sobre toda la lista).

    NOTA sobre OBSERVADO: `_cerrar_checklist_vencido` (el camino de
    escritura) también pisa OBSERVADO con CERRADO al reabrir un día; la
    corrección de lectura de arriba NO lo replica (un checklist observado
    de un día pasado se muestra observado). Es una inconsistencia conocida
    entre ambos caminos: cuál es el comportamiento correcto queda como
    decisión abierta.
    """
    hoy_val = hoy()

    if fecha_desde > fecha_hasta:
        raise FechaInvalida()

    consulta, filtros = _consulta_historial(
        fecha_desde, fecha_hasta, equipo_id, buscar
    )

    if page is None:
        checklists = db.scalars(
            aplicar_orden(
                consulta.where(*filtros),
                models.Checklist,
                orden,
                _ORDENES_HISTORIAL,
                "fecha_desc",
            )
        ).all()

        items: List[schemas.HistorialChecklistItem] = []
        total_general = 0
        completadas_general = 0
        for cl in checklists:
            item = _construir_item_historial(cl, hoy_val)
            items.append(item)
            total_general += item.total_tareas
            completadas_general += item.tareas_completadas

        return schemas.HistorialChecklistResponse(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            equipo_id=equipo_id,
            porcentaje_cumplimiento_general=(
                completadas_general / total_general * 100 if total_general else 0.0
            ),
            checklists=items,
        )

    # Página pedida: el recorte lo hace la base y el desempate por `id` lo
    # agrega `paginar_consulta`, así recorrer las páginas no repite ni omite
    # checklists.
    checklists, total = paginar_consulta(
        db,
        consulta,
        modelo=models.Checklist,
        filtros=filtros,
        orden=orden,
        ordenes=_ORDENES_HISTORIAL,
        por_defecto="fecha_desc",
        page=page,
        page_size=page_size,
    )

    # El % general se calcula sobre TODO el período (no cambia con la página),
    # con un agregado en SQL en vez de cargar los registros de cada checklist.
    porcentaje_general = _porcentaje_cumplimiento_periodo(
        db, fecha_desde, fecha_hasta, equipo_id, buscar
    )

    return schemas.HistorialChecklistPagina(
        items=[_construir_item_historial(cl, hoy_val) for cl in checklists],
        total=total,
        page=page,
        page_size=page_size,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        equipo_id=equipo_id,
        porcentaje_cumplimiento_general=porcentaje_general,
    )


def obtener_detalle_checklist(
    db: Session, checklist_id: int
) -> schemas.DetalleChecklistResponse:
    """Devuelve la fotografía registrada de todas las tareas de un checklist.

    El nombre y la descripción pertenecen al snapshot de RegistroTarea. En
    cambio, insumo, unidad y elemento se resuelven desde los catálogos vigentes,
    porque esos nombres no se guardan como snapshots históricos.

    El estado se muestra con la MISMA regla que la lista del historial
    (`_estado_a_mostrar`), para que el badge del diálogo no contradiga al
    de la fila que lo abrió. La corrección es solo del valor devuelto: el
    objeto ORM no se modifica.
    """
    checklist = db.scalar(
        select(models.Checklist)
        .where(models.Checklist.id == checklist_id)
        .options(
            selectinload(models.Checklist.equipo),
            selectinload(models.Checklist.registros).selectinload(
                models.RegistroTarea.usuario
            ),
            selectinload(models.Checklist.registros)
            .selectinload(models.RegistroTarea.insumo_quimico)
            .selectinload(InsumoQuimico.unidad_medida),
            selectinload(models.Checklist.registros).selectinload(
                models.RegistroTarea.elemento_limpieza
            ),
        )
    )
    if checklist is None:
        raise exceptions.ChecklistNoEncontrado()

    registros = sorted(checklist.registros, key=lambda registro: registro.id)
    tareas_completadas = sum(1 for registro in registros if registro.completado)

    tareas = []
    for registro in registros:
        usuario_nombre = None
        if registro.usuario is not None:
            usuario_nombre = (
                f"{registro.usuario.nombre} {registro.usuario.apellido or ''}".strip()
            )

        insumo = registro.insumo_quimico
        unidad_medida_simbolo = None
        if insumo is not None and insumo.unidad_medida is not None:
            unidad_medida_simbolo = insumo.unidad_medida.simbolo

        tareas.append(
            schemas.DetalleChecklistTareaItem(
                registro_id=registro.id,
                nombre=registro.nombre_tarea_historico,
                descripcion=registro.descripcion_tarea_historico,
                completado=registro.completado,
                fecha_completado=registro.fecha_completado,
                usuario_nombre=usuario_nombre,
                evidencia_url=registro.evidencia_url,
                insumo_quimico_nombre=insumo.nombre if insumo is not None else None,
                cantidad_consumida=registro.cantidad_consumida,
                unidad_medida_simbolo=unidad_medida_simbolo,
                elemento_limpieza_nombre=(
                    registro.elemento_limpieza.nombre
                    if registro.elemento_limpieza is not None
                    else None
                ),
            )
        )

    return schemas.DetalleChecklistResponse(
        checklist_id=checklist.id,
        fecha=checklist.fecha,
        equipo_id=checklist.equipo_id,
        equipo_nombre=checklist.equipo.nombre,
        # Mismo criterio que la lista (ver `_estado_a_mostrar`): el ORM
        # queda intacto, solo cambia lo que se devuelve.
        estado=_estado_a_mostrar(checklist, hoy()),
        total_tareas=len(registros),
        tareas_completadas=tareas_completadas,
        porcentaje_cumplimiento=(
            tareas_completadas / len(registros) * 100 if registros else 0.0
        ),
        tareas=tareas,
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

    # Acumulamos por producto. Las fechas se mantienen por producto, porque
    # sumar en una misma fecha litros, kilos u otras unidades es inválido.
    por_insumo: Dict[int, Dict[str, object]] = {}
    por_producto_fecha: Dict[tuple[int, date_], float] = {}

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

        por_producto_fecha[(insumo_id, fecha)] = cantidad_total

    # Completamos nombre y unidad de cada producto con una sola consulta.
    ids = list(por_insumo.keys())
    nombres: Dict[int, tuple] = {}

    if ids:
        nombres = {
            id_: (nombre, unidad_id, simbolo)
            for id_, nombre, unidad_id, simbolo in db.execute(
                select(
                    InsumoQuimico.id,
                    InsumoQuimico.nombre,
                    InsumoQuimico.unidad_medida_id,
                    UnidadMedida.simbolo,
                )
                .join(UnidadMedida, InsumoQuimico.unidad_medida_id == UnidadMedida.id)
                .where(InsumoQuimico.id.in_(ids))
            ).all()
        }

    items: List[schemas.ConsumoInsumoItem] = []

    for insumo_id, datos in por_insumo.items():
        nombre, _, simbolo = nombres.get(insumo_id, (None, None, None))
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

    totales_por_unidad: Dict[tuple[int, Optional[str]], float] = {}
    detalle_por_fecha = []
    for (insumo_id, fecha), cantidad_total in sorted(por_producto_fecha.items(), key=lambda item: item[0][1]):
        nombre, unidad_id, simbolo = nombres.get(insumo_id, (f"Insumo {insumo_id}", 0, None))
        clave_unidad = (unidad_id, simbolo)
        totales_por_unidad[clave_unidad] = totales_por_unidad.get(clave_unidad, 0.0) + cantidad_total
        detalle_por_fecha.append(
            schemas.ConsumoPorFechaItem(
                fecha=fecha,
                insumo_quimico_id=insumo_id,
                nombre=nombre,
                unidad_medida_id=unidad_id,
                unidad_simbolo=simbolo,
                cantidad_total=round(cantidad_total, 2),
            )
        )

    return schemas.ConsumoInsumosResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumos=items,
        totales_por_unidad=[
            schemas.ConsumoPorUnidadItem(
                unidad_medida_id=unidad_id,
                unidad_simbolo=simbolo,
                cantidad_total=round(total, 2),
            )
            for (unidad_id, simbolo), total in sorted(totales_por_unidad.items())
        ],
        por_producto_fecha=detalle_por_fecha,
    )
