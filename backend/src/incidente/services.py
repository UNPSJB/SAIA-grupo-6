import logging
import unicodedata
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload
from src.common.paginacion import paginar
from src.common.persistence import guardar
from src.incidente import models, schemas, exceptions
from src.incidente.constants import EstadoIncidente, TipoIncidente
from src.Equipo.models import Equipo
from src.personal.models import Personal

logger = logging.getLogger(__name__)


# Relaciones que se cargan siempre para poder devolver los nombres en la respuesta.
_RELACIONES = (
    selectinload(models.Incidente.equipo),
    selectinload(models.Incidente.usuario),
    selectinload(models.Incidente.responsable_cierre),
)


def _nombre_completo(persona: Optional[Personal]) -> Optional[str]:
    if persona is None:
        return None
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _normalizar_texto(texto: str) -> str:
    """Minúsculas y sin tildes, igual que la búsqueda que hacía el frontend:
    'López' y 'lopez' son lo mismo para el filtro de la tabla."""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )


def _completar_nombres(incidentes: List[models.Incidente]) -> List[models.Incidente]:
    """Las relaciones se cargan a mano para evitar consultas perezosas."""
    for inc in incidentes:
        if inc.equipo:
            inc.equipo_nombre = inc.equipo.nombre
        inc.usuario_nombre = _nombre_completo(inc.usuario)
        inc.responsable_cierre_nombre = _nombre_completo(inc.responsable_cierre)
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


def crear_incidente(db: Session, datos: schemas.IncidenteCreate, usuario_id: int) -> models.Incidente:
    _verificar_equipo(db, datos.equipo_id)
    _verificar_usuario(db, usuario_id)

    incidente = models.Incidente(
        titulo=datos.titulo,
        descripcion=datos.descripcion,
        tipo=datos.tipo,
        equipo_id=datos.equipo_id,
        foto_url=datos.foto_url,
        usuario_id=usuario_id,
        fecha_reporte=datetime.now(),
        estado=EstadoIncidente.ABIERTO.value,
    )
    db.add(incidente)
    return guardar(db, incidente)


def _consulta_incidentes(
    estado: Optional[EstadoIncidente],
    tipo: Optional[str],
    equipo_id: Optional[int],
    orden: Optional[str],
) -> Select:
    """Consulta base del listado: filtros en el WHERE y orden estable.

    El desempate por `id` es lo que hace seguro el OFFSET/LIMIT: solo por
    `fecha_reporte` hay filas con la misma fecha y el recorte puede repetir
    u omitir registros entre páginas.
    """
    consulta = select(models.Incidente).options(*_RELACIONES)

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

    if orden == "antiguos":
        # Lo pide la tabla de gestión: los que llevan más tiempo sin
        # resolverse quedan arriba.
        consulta = consulta.order_by(
            models.Incidente.fecha_reporte.asc(), models.Incidente.id.asc()
        )
    else:
        consulta = consulta.order_by(
            models.Incidente.fecha_reporte.desc(), models.Incidente.id.desc()
        )

    return consulta


def _filtrar_por_busqueda(
    incidentes: List[models.Incidente], buscar: Optional[str]
) -> List[models.Incidente]:
    """Deja los incidentes que matchean el término en título, descripción o
    quien reportó (mayúsculas y tildes insensibles).

    SQLite no tiene forma portable de normalizar tildes en SQL (no existe
    `unaccent`), así que el filtro de texto se aplica en Python: el costo
    documentado está en el docstring de `listar_incidentes_paginado`.
    """
    if not (buscar and buscar.strip()):
        return incidentes

    termino = _normalizar_texto(buscar.strip())
    return [
        inc
        for inc in incidentes
        if termino in _normalizar_texto(inc.titulo)
        or termino in _normalizar_texto(inc.descripcion or "")
        or termino in _normalizar_texto(inc.usuario_nombre or "")
    ]


def listar_incidentes(
    db: Session,
    estado: Optional[EstadoIncidente] = None,
    tipo: Optional[str] = None,
    equipo_id: Optional[int] = None,
    orden: Optional[str] = None,
    buscar: Optional[str] = None,
) -> List[models.Incidente]:
    """Lista los incidentes, por defecto del más reciente al más viejo.

    Sin `estado` devuelve todos (abiertos y cerrados); con `estado` filtra.
    `orden="antiguos"` invierte el criterio. Es el camino SIN paginar: lo
    usan el tablero y el resumen, que necesitan el conjunto completo.

    `buscar` se aplica con la misma lógica que en el camino paginado: antes
    el router lo descartaba en silencio y quien lo mandaba recibía la lista
    completa sin filtrar.
    """
    consulta = _consulta_incidentes(estado, tipo, equipo_id, orden)
    incidentes = _completar_nombres(list(db.scalars(consulta).all()))
    return _filtrar_por_busqueda(incidentes, buscar)


def listar_incidentes_paginado(
    db: Session,
    estado: Optional[EstadoIncidente],
    tipo: Optional[str],
    equipo_id: Optional[int],
    buscar: Optional[str],
    orden: Optional[str],
    page: int,
    page_size: int,
) -> tuple[List[models.Incidente], int]:
    """Página del listado, recortada por la BASE (COUNT + OFFSET/LIMIT).

    `estado`, `tipo`, `equipo_id` y el `orden` van en el WHERE/ORDER BY de
    la consulta, así que sin término de búsqueda la página sale entera de
    SQL y no se cargan más filas que las de la página.

    Limitación de `buscar` (documentada a pedido): la búsqueda es
    insensible a mayúsculas y TILDES, y cubre el nombre de quien reportó.
    SQLite no tiene una forma portable de normalizar tildes en SQL (no
    existe `unaccent`), así que cuando hay término de búsqueda el filtro de
    texto se aplica en Python sobre el conjunto ya acotado por los demás
    filtros: en ese caso sí se cargan todas las filas que cumplen
    estado/tipo/equipo. Es el único caso; sin `buscar` la paginación es
    100% en la base.
    """
    consulta = _consulta_incidentes(estado, tipo, equipo_id, orden)

    if not (buscar and buscar.strip()):
        incidentes, total = paginar(db, consulta, page, page_size)
        return _completar_nombres(incidentes), total

    # Camino con búsqueda: ver la limitación en el docstring.
    incidentes = _filtrar_por_busqueda(
        _completar_nombres(list(db.scalars(consulta).all())), buscar
    )

    total = len(incidentes)
    inicio = (page - 1) * page_size
    return incidentes[inicio : inicio + page_size], total


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


def listar_mis_incidentes(db: Session, usuario_id: int) -> List[models.Incidente]:
    """Lista los incidentes reportados por un usuario específico (para operadores)."""
    consulta = (
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.usuario_id == usuario_id)
        .order_by(models.Incidente.fecha_reporte.desc(), models.Incidente.id.desc())
    )
    return _completar_nombres(list(db.scalars(consulta).all()))


def listar_mis_incidentes_paginado(
    db: Session, usuario_id: int, page: int, page_size: int
) -> tuple[List[models.Incidente], int]:
    """Página de los incidentes del usuario, recortada por la BASE.

    El filtro es un simple `usuario_id`, así que la consulta sale entera en
    SQL con COUNT + OFFSET/LIMIT y el orden estable de `listar_mis_incidentes`.
    """
    consulta = (
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.usuario_id == usuario_id)
        .order_by(models.Incidente.fecha_reporte.desc(), models.Incidente.id.desc())
    )
    incidentes, total = paginar(db, consulta, page, page_size)
    return _completar_nombres(incidentes), total


def resumen_por_tipo(
    db: Session, estado: Optional[EstadoIncidente] = None
) -> schemas.IncidenteResumenResponse:
    """Cuenta incidentes por tipo para el indicador del tablero (E7).

    Devuelve los cinco tipos siempre, con 0 si no hay registros. Por
    defecto es el universo de los abiertos (la historia de "incidentes abiertos":
    que ninguno quede reportado y olvidado).
    """
    consulta = select(
        models.Incidente.tipo, func.count(models.Incidente.id)
    ).group_by(models.Incidente.tipo)
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


def cambiar_estado_incidente(
    db: Session,
    incidente_id: int,
    estado: EstadoIncidente,
    current_user: Personal,
    observacion_cierre: Optional[str] = None,
) -> models.Incidente:
    """Cierra o reabre un incidente.

    Al cerrar se asienta la acción correctiva, cuándo se cerró y quién lo
    resolvió. Al reabrir se limpia esa información para que no quede
    desactualizada. Además, guarda un evento en el historial de incidentes.
    """
    incidente = db.scalar(
        select(models.Incidente)
        .options(*_RELACIONES)
        .where(models.Incidente.id == incidente_id)
    )
    if incidente is None:
        raise exceptions.IncidenteNoEncontrado()

    if incidente.estado == estado.value:
        # Ya está en ese estado: no se pisa la fecha de cierre original.
        # Aun así hay que completar los nombres: sin esto, este camino
        # devolvía los tres campos de nombre en null (son Optional, así que
        # la inconsistencia con el GET pasaba inadvertida).
        return _completar_nombres([incidente])[0]

    estado_anterior = incidente.estado

    if estado == EstadoIncidente.CERRADO:
        _verificar_usuario(db, current_user.id)
        incidente.estado = EstadoIncidente.CERRADO.value
        incidente.fecha_cierre = datetime.now()
        incidente.responsable_cierre_id = current_user.id
        incidente.observacion_cierre = observacion_cierre
        logger.info(
            "Incidente %s cerrado por %s", incidente.id, current_user.id
        )
    else:
        incidente.estado = EstadoIncidente.ABIERTO.value
        incidente.fecha_cierre = None
        incidente.responsable_cierre_id = None
        incidente.observacion_cierre = None
        logger.info("Incidente %s reabierto por %s", incidente.id, current_user.id)

    # Guardar evento en el historial
    db.add(
        models.HistorialIncidente(
            incidente_id=incidente.id,
            estado_anterior=estado_anterior,
            estado_nuevo=estado.value,
            usuario_id=current_user.id,
            observacion=observacion_cierre,
        )
    )

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