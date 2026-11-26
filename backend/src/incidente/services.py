import logging
from datetime import date
from typing import List, Optional
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload
from src.common.fechas import ahora
from src.common.listados import ColumnaOrden, aplicar_orden, filtro_busqueda
from src.common.paginacion import paginar
from src.common.persistence import guardar
from src.incidente import models, schemas, exceptions
from src.incidente.constants import (
    EstadoIncidente,
    OrigenIncidente,
    TIPOS_DE_CIRCUITO,
    TipoIncidente,
)
from src.Equipo.models import Equipo
from src.personal.models import Personal
from src.reclamos.models import Reclamo
from src.retiros.models import Retiro

logger = logging.getLogger(__name__)


# Relaciones que se cargan siempre para poder devolver los nombres en la respuesta.
_RELACIONES = (
    selectinload(models.Incidente.equipo),
    selectinload(models.Incidente.usuario),
    selectinload(models.Incidente.responsable_cierre),
)


# Órdenes válidos del listado de gestión. `recientes`/`antiguos` son los alias
# que usaba la tabla antes de que existiera el orden por columna: se mantienen
# porque el verifier y otros consumidores los siguen mandando.
_ORDENES_INCIDENTE = {
    "recientes": ColumnaOrden((models.Incidente.fecha_reporte,), descendente=True),
    "antiguos": ColumnaOrden((models.Incidente.fecha_reporte,)),
    "fecha_asc": ColumnaOrden((models.Incidente.fecha_reporte,)),
    "fecha_desc": ColumnaOrden((models.Incidente.fecha_reporte,), descendente=True),
    "estado_asc": ColumnaOrden((models.Incidente.estado,)),
    "estado_desc": ColumnaOrden((models.Incidente.estado,), descendente=True),
    "tipo_asc": ColumnaOrden((models.Incidente.tipo,)),
    "tipo_desc": ColumnaOrden((models.Incidente.tipo,), descendente=True),
}


def _nombre_completo(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _completar_nombres(incidentes: List[models.Incidente]) -> List[models.Incidente]:
    """Las relaciones se cargan a mano para evitar consultas perezosas."""
    for inc in incidentes:
        if inc.equipo:
            inc.equipo_nombre = inc.equipo.nombre
        inc.usuario_nombre = _nombre_completo(inc.usuario)
        inc.responsable_cierre_nombre = _nombre_completo(inc.responsable_cierre)
    return incidentes


def _completar_circuito(
    db: Session, incidentes: List[models.Incidente]
) -> List[models.Incidente]:
    """Agrega el reclamo o el retiro donde se resuelve cada incidente.

    El vínculo se guarda del otro lado (`reclamos.incidente_id`,
    `retiros.incidente_id`): una consulta por tabla para todo el listado.
    """
    for modelo, atributo, tipo in (
        (Reclamo, "reclamo_id", TipoIncidente.RECLAMO_CLIENTE),
        (Retiro, "retiro_id", TipoIncidente.RETIRO_LOTE),
    ):
        ids = [i.id for i in incidentes if i.tipo == tipo.value]
        if not ids:
            continue
        por_incidente = dict(
            db.execute(
                select(modelo.incidente_id, modelo.id).where(
                    modelo.incidente_id.in_(ids)
                )
            ).all()
        )
        for incidente in incidentes:
            if incidente.id in por_incidente:
                setattr(incidente, atributo, por_incidente[incidente.id])
    return incidentes


def _verificar_equipo(db: Session, equipo_id: Optional[int]) -> None:
    """Verifica que el equipo exista y esté activo (si se especifica)."""
    if equipo_id is None:
        return
    equipo = db.scalar(select(Equipo).where(Equipo.id == equipo_id))
    if equipo is None:
        raise exceptions.EquipoNoEncontrado()
    if not equipo.activo:
        raise exceptions.EquipoInactivo()


def _verificar_usuario(db: Session, usuario_id: int) -> None:
    """Verifica que el usuario exista y esté activo."""
    usuario = db.scalar(select(Personal).where(Personal.id == usuario_id))
    if usuario is None:
        raise exceptions.UsuarioNoEncontrado()
    if not usuario.activo:
        raise exceptions.UsuarioInactivo()


def crear_incidente_vinculado(
    db: Session,
    *,
    titulo: str,
    descripcion: str,
    tipo: str,
    usuario_id: int,
    equipo_id: Optional[int] = None,
    foto_url: Optional[str] = None,
    lote_id: Optional[int] = None,
    salida_id: Optional[int] = None,
) -> models.Incidente:
    """Crea un incidente ABIERTO sin commitear.

    Es la versión transaccional de `crear_incidente`: la usan los flujos que
    necesitan que el incidente, la entidad que lo origina y su hito se guarden
    en UNA sola transacción (por ejemplo el rechazo de una entrega). El caller
    hace el commit. La verificación del usuario la hace el caller.
    """
    incidente = models.Incidente(
        titulo=titulo,
        descripcion=descripcion,
        tipo=tipo,
        equipo_id=equipo_id,
        foto_url=foto_url,
        usuario_id=usuario_id,
        fecha_reporte=ahora(),
        estado=EstadoIncidente.ABIERTO.value,
        lote_id=lote_id,
        salida_id=salida_id,
    )
    db.add(incidente)
    db.flush()
    return incidente


def crear_incidente(db: Session, datos: schemas.IncidenteCreate, usuario_id: int) -> models.Incidente:
    _verificar_equipo(db, datos.equipo_id)
    _verificar_usuario(db, usuario_id)

    incidente = crear_incidente_vinculado(
        db,
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        usuario_id=usuario_id,
        equipo_id=datos.equipo_id,
        foto_url=datos.foto_url,
    )
    return guardar(db, incidente)


def _validar_rango_fechas(
    fecha_desde: Optional[date], fecha_hasta: Optional[date]
) -> None:
    """Rechaza un rango cuya fecha inicial es posterior a la final."""
    if fecha_desde is not None and fecha_hasta is not None and fecha_desde > fecha_hasta:
        raise exceptions.FechaInvalida()


def _aplicar_rango_fechas(
    consulta,
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
):
    """Acota la consulta a un rango de fechas de reporte, inclusive.

    Se compara por `func.date(...)`: `fecha_reporte` es un `DateTime` y sin el
    corte por día un `hasta` a las 00:00 se comería el día completo.
    """
    if fecha_desde is not None:
        consulta = consulta.where(
            func.date(models.Incidente.fecha_reporte) >= fecha_desde
        )
    if fecha_hasta is not None:
        consulta = consulta.where(
            func.date(models.Incidente.fecha_reporte) <= fecha_hasta
        )
    return consulta


def _aplicar_origen(consulta, origen: Optional[OrigenIncidente]):
    """Acota a los reportados por una persona o a los abiertos por un circuito."""
    if origen is None:
        return consulta
    tipos = [tipo.value for tipo in TIPOS_DE_CIRCUITO]
    if origen == OrigenIncidente.CIRCUITO:
        return consulta.where(models.Incidente.tipo.in_(tipos))
    return consulta.where(models.Incidente.tipo.not_in(tipos))


def _consulta_incidentes(
    estado: Optional[EstadoIncidente],
    tipo: Optional[str],
    equipo_id: Optional[int],
    orden: Optional[str],
    buscar: Optional[str] = None,
) -> Select:
    """Consulta base del listado: filtros en el WHERE y orden estable.

    La búsqueda se resuelve en SQL (título, descripción y nombre de quien
    reportó). El join con `Personal` es many-to-one por clave primaria, así que
    no duplica filas ni rompe el COUNT/LIMIT; `sin_tildes` (ver
    `src.common.texto`) es la función que permite comparar sin acentos.

    El desempate por `id` es lo que hace seguro el OFFSET/LIMIT: solo por
    `fecha_reporte` hay filas con la misma fecha y el recorte puede repetir
    u omitir registros entre páginas.
    """
    consulta = (
        select(models.Incidente)
        .join(Personal, Personal.id == models.Incidente.usuario_id)
        .options(*_RELACIONES)
    )

    if estado:
        # El router ya convierte el query param con el enum de FastAPI, así que
        # acá llega como `EstadoIncidente`. Se acepta también un `str` suelta
        # para no romper callers que la pasen así.
        valor = estado.value if isinstance(estado, EstadoIncidente) else str(estado)
        consulta = consulta.where(models.Incidente.estado == valor)
    if tipo:
        consulta = consulta.where(models.Incidente.tipo == tipo)
    if equipo_id:
        consulta = consulta.where(models.Incidente.equipo_id == equipo_id)

    filtro_texto = filtro_busqueda(
        (
            models.Incidente.titulo,
            models.Incidente.descripcion,
            Personal.nombre,
            Personal.apellido,
        ),
        buscar,
    )
    if filtro_texto is not None:
        consulta = consulta.where(filtro_texto)

    # Por defecto, el más reciente arriba. `aplicar_orden` agrega el desempate
    # por `id` que hace seguro el OFFSET/LIMIT entre páginas.
    return aplicar_orden(
        consulta,
        models.Incidente,
        orden,
        _ORDENES_INCIDENTE,
        "recientes",
    )


def listar_incidentes(
    db: Session,
    estado: Optional[EstadoIncidente] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    orden: Optional[str] = None,
    buscar: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    reportado_por: Optional[int] = None,
    origen: Optional[OrigenIncidente] = None,
) -> List[models.Incidente]:
    """Lista los incidentes, por defecto del más reciente al más viejo.

    Sin `estado` devuelve todos (abiertos y cerrados); con `estado` filtra.
    `orden="antiguos"` invierte el criterio. Es el camino SIN paginar: lo
    usan el tablero y el resumen, que necesitan el conjunto completo.

    `buscar` se resuelve en el WHERE (título, descripción y nombre de quien
    reportó), igual que en el camino paginado: antes el router lo descartaba
    en silencio y quien lo mandaba recibía la lista completa sin filtrar.
    `fecha_desde`/`fecha_hasta` acotan por fecha de reporte (inclusive).
    """
    _validar_rango_fechas(fecha_desde, fecha_hasta)
    consulta = _consulta_incidentes(estado, tipo, equipo_id, orden, buscar)
    consulta = _aplicar_rango_fechas(consulta, fecha_desde, fecha_hasta)
    consulta = _aplicar_origen(consulta, origen)
    if reportado_por is not None:
        consulta = consulta.where(models.Incidente.usuario_id == reportado_por)
    incidentes = list(db.scalars(consulta).all())
    return _completar_circuito(db, _completar_nombres(incidentes))


def listar_incidentes_paginado(
    db: Session,
    estado: Optional[EstadoIncidente],
    tipo: Optional[str],
    equipo_id: Optional[int],
    buscar: Optional[str],
    orden: Optional[str],
    page: int,
    page_size: int,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    reportado_por: Optional[int] = None,
    origen: Optional[OrigenIncidente] = None,
) -> tuple[List[models.Incidente], int]:
    """Página del listado, recortada por la BASE (COUNT + OFFSET/LIMIT).

    Todos los filtros —estado, tipo, equipo, rango de fechas y búsqueda de
    texto— viajan en el WHERE, así que la consulta trae solo las filas de la
    página. La búsqueda ignora mayúsculas y tildes gracias a `sin_tildes`, la
    función SQLite que registra `src.common.texto`; también cubre el nombre y
    el apellido de quien reportó (join many-to-one con `personal`, que no
    duplica filas).
    """
    _validar_rango_fechas(fecha_desde, fecha_hasta)
    consulta = _consulta_incidentes(estado, tipo, equipo_id, orden, buscar)
    consulta = _aplicar_rango_fechas(consulta, fecha_desde, fecha_hasta)
    consulta = _aplicar_origen(consulta, origen)
    if reportado_por is not None:
        consulta = consulta.where(models.Incidente.usuario_id == reportado_por)
    incidentes, total = paginar(db, consulta, page, page_size)
    return _completar_circuito(db, _completar_nombres(incidentes)), total


def obtener_incidente(db: Session, incidente_id: int, current_user: Personal) -> models.Incidente:
    incidente = db.scalar(
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()

    # Operador solo ve sus propios incidentes
    if not (current_user.puede_administrar or current_user.es_super_admin):
        if incidente.usuario_id != current_user.id:
            raise exceptions.PermisoDenegado()

    _completar_nombres([incidente])
    return incidente


def _consulta_mis_incidentes(
    usuario_id: int, estado: Optional[EstadoIncidente]
) -> Select:
    """Incidentes del usuario, siempre del más reciente al más viejo.

    El orden es fijo (no se expone `orden` en "Mis reportes"), pero se mantiene
    el desempate por `id` para que OFFSET/LIMIT no repita ni omita filas.
    """
    consulta = (
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.usuario_id == usuario_id)
    )
    if estado:
        valor = estado.value if isinstance(estado, EstadoIncidente) else str(estado)
        consulta = consulta.where(models.Incidente.estado == valor)
    return consulta.order_by(
        models.Incidente.fecha_reporte.desc(), models.Incidente.id.desc()
    )


def listar_mis_incidentes(
    db: Session,
    usuario_id: int,
    estado: Optional[EstadoIncidente] = None,
) -> List[models.Incidente]:
    """Lista los incidentes reportados por un usuario específico (para operadores).

    Sin `estado` devuelve abiertos y cerrados.
    """
    consulta = _consulta_mis_incidentes(usuario_id, estado)
    return _completar_nombres(list(db.scalars(consulta).all()))


def listar_mis_incidentes_paginado(
    db: Session,
    usuario_id: int,
    page: int,
    page_size: int,
    estado: Optional[EstadoIncidente] = None,
) -> tuple[List[models.Incidente], int]:
    """Página de los incidentes del usuario, recortada por la BASE.

    El filtro es `usuario_id` (y opcionalmente `estado`), así que la consulta
    sale entera en SQL con COUNT + OFFSET/LIMIT y el orden estable de
    `listar_mis_incidentes`.
    """
    consulta = _consulta_mis_incidentes(usuario_id, estado)
    incidentes, total = paginar(db, consulta, page, page_size)
    return _completar_nombres(incidentes), total


def resumen_por_tipo(
    db: Session,
    estado: Optional[EstadoIncidente] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> schemas.IncidenteResumenResponse:
    """Cuenta incidentes por tipo para el indicador del tablero (E7).

    Devuelve todos los tipos siempre, con 0 si no hay registros. Por
    defecto es el universo de los abiertos (la historia de "incidentes abiertos":
    que ninguno quede reportado y olvidado). `fecha_desde`/`fecha_hasta`
    acotan por fecha de reporte (inclusive).
    """
    _validar_rango_fechas(fecha_desde, fecha_hasta)

    consulta = select(
        models.Incidente.tipo, func.count(models.Incidente.id)
    ).group_by(models.Incidente.tipo)
    consulta = _aplicar_rango_fechas(consulta, fecha_desde, fecha_hasta)
    if estado:
        consulta = consulta.where(models.Incidente.estado == estado.value)

    conteos = {tipo.value: 0 for tipo in TipoIncidente}
    for tipo, cantidad in db.execute(consulta).all():
        if tipo in conteos:
            conteos[tipo] = cantidad

    return schemas.IncidenteResumenResponse(
        estado=estado.value if estado else "todos",
        total=sum(conteos.values()),
        por_tipo=[
            schemas.IncidenteResumenTipo(tipo=t, cantidad=conteos[t])
            for t in (tipo.value for tipo in TipoIncidente)
        ],
    )


def cerrar_incidente(
    db: Session,
    incidente: models.Incidente,
    current_user: Personal,
    observacion_cierre: Optional[str] = None,
) -> models.Incidente:
    """Cierra un incidente y asienta la acción correctiva, SIN commitear.

    La usan también los circuitos que abren incidentes (rechazo, reclamo y
    retiro), para cerrarlo dentro de su propia transacción. Deja el incidente
    en `flush`.
    """
    if incidente.estado == EstadoIncidente.CERRADO.value:
        return incidente

    observacion = (observacion_cierre or "").strip() or None
    # Un reclamo de cliente no se cierra sin asentar la acción correctiva.
    if incidente.tipo == TipoIncidente.RECLAMO_CLIENTE.value and observacion is None:
        raise exceptions.ObservacionCierreRequerida()

    _verificar_usuario(db, current_user.id)
    # Plan de acción obligatorio: si el incidente lo exige y no lo tiene, no
    # se cierra (import tardío: planes_accion depende de incidentes).
    from src.planes_accion.obligacion import exigir_plan_al_cerrar

    exigir_plan_al_cerrar(db, incidente)
    estado_anterior = incidente.estado
    incidente.estado = EstadoIncidente.CERRADO.value
    incidente.fecha_cierre = ahora()
    incidente.responsable_cierre_id = current_user.id
    incidente.observacion_cierre = observacion

    db.add(
        models.HistorialIncidente(
            incidente_id=incidente.id,
            estado_anterior=estado_anterior,
            estado_nuevo=EstadoIncidente.CERRADO.value,
            usuario_id=current_user.id,
            observacion=observacion,
        )
    )
    db.flush()
    logger.info("Incidente %s cerrado por %s", incidente.id, current_user.id)
    return incidente


def reabrir_incidente(
    db: Session,
    incidente: models.Incidente,
    current_user: Personal,
    motivo: Optional[str] = None,
) -> models.Incidente:
    """Vuelve a abrir un incidente cerrado, SIN commitear.

    Limpia los datos del cierre para que no queden desactualizados: el cierre
    anterior sigue en el historial.
    """
    if incidente.estado == EstadoIncidente.ABIERTO.value:
        return incidente

    estado_anterior = incidente.estado
    incidente.estado = EstadoIncidente.ABIERTO.value
    incidente.fecha_cierre = None
    incidente.responsable_cierre_id = None
    incidente.observacion_cierre = None
    db.add(
        models.HistorialIncidente(
            incidente_id=incidente.id,
            estado_anterior=estado_anterior,
            estado_nuevo=EstadoIncidente.ABIERTO.value,
            usuario_id=current_user.id,
            observacion=motivo,
        )
    )
    db.flush()
    logger.info("Incidente %s reabierto por %s", incidente.id, current_user.id)
    return incidente


def cambiar_estado_incidente(
    db: Session,
    incidente_id: int,
    estado: EstadoIncidente,
    current_user: Personal,
    observacion_cierre: Optional[str] = None,
) -> models.Incidente:
    """Cierra o reabre un incidente reportado, y lo asienta en el historial.

    Los de un circuito no pasan por acá: se resuelven donde se originaron.
    """
    incidente = db.scalar(
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()

    # Va antes del early return de "mismo estado" para que reabrir uno ya
    # cerrado también devuelva el error y no un 200 silencioso.
    if incidente.tipo in {tipo.value for tipo in TIPOS_DE_CIRCUITO}:
        raise exceptions.IncidenteInmutable()

    if incidente.estado == estado.value:
        # Ya está en ese estado: no se pisa la fecha de cierre original.
        # Aun así hay que completar los nombres: sin esto, este camino
        # devolvía los tres campos de nombre en null (son Optional, así que
        # la inconsistencia con el GET pasaba inadvertida).
        return _completar_nombres([incidente])[0]

    if estado == EstadoIncidente.CERRADO:
        cerrar_incidente(db, incidente, current_user, observacion_cierre)
    else:
        reabrir_incidente(db, incidente, current_user, observacion_cierre)

    guardar(db, incidente)

    # refresh deja las relaciones sin cargar: hay que volver a consultarlas.
    return obtener_incidente(db, incidente_id, current_user)


def obtener_historial_incidente(
    db: Session, incidente_id: int, current_user: Personal
) -> schemas.HistorialIncidenteResponse:
    """Obtiene el historial de cierre/reapertura de un incidente.

    Igual que en el detalle, un operador solo ve el historial de sus propios
    incidentes: este endpoint no expone el historial (ni la observación de
    cierre) de incidentes ajenos por ID.
    """
    incidente = db.scalar(
        select(models.Incidente).where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()
    if not (current_user.puede_administrar or current_user.es_super_admin):
        if incidente.usuario_id != current_user.id:
            raise exceptions.PermisoDenegado()

    eventos = db.scalars(
        select(models.HistorialIncidente)
        .where(models.HistorialIncidente.incidente_id == incidente_id)
        .options(selectinload(models.HistorialIncidente.usuario))
        .order_by(models.HistorialIncidente.fecha_evento)
    ).all()

    items = []
    for e in eventos:
        item = schemas.HistorialIncidenteItem.model_validate(e)
        if e.usuario is not None:
            item.usuario_nombre = _nombre_completo(e.usuario)
        items.append(item)

    return schemas.HistorialIncidenteResponse(
        incidente_id=incidente_id,
        eventos=items,
    )