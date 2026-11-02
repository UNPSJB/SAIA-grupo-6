from datetime import date as date_
from typing import List, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from src.checklist import models, schemas
from src.common.fechas import hoy
from src.common.listados import ColumnaOrden, aplicar_orden, filtro_busqueda, paginar_consulta
from src.common.texto import sin_tildes
from src.Equipo.models import Equipo
from src.checklist import exceptions
from src.checklist.exceptions import (
    FechaInvalida,
)
from src.insumoQuimico.models import InsumoQuimico


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
