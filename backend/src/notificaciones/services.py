from datetime import date, timedelta
from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from src.Equipo.models import Equipo
from src.elementoLimpieza.models import ElementoLimpieza
from src.notificaciones.schemas import NotificacionResponse
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento

from src.aptitud.models import Aptitud
from src.notificaciones.models import ConfiguracionAlerta
from src.personal.models import Personal
from src.vencimientoPersonal.models import VencimientoPersonal

MARGEN_DIAS_ALERTA = 3
CLAVE_DIAS_VENCIMIENTO_PERSONAL = "dias_alerta_vencimiento_personal"
DIAS_VENCIMIENTO_PERSONAL_POR_DEFECTO = 15



def obtener_notificaciones_elementos_limpieza(db: Session) -> List[NotificacionResponse]:
    notificaciones: List[NotificacionResponse] = []
    hoy = date.today()

    elementos = db.scalars(
        select(ElementoLimpieza).where(ElementoLimpieza.activo.is_(True))
    ).all()

    for elem in elementos:
        if not elem.fecha_ultimo_recambio or not elem.frecuencia_recambio_dias:
            continue

        fecha_vencimiento = elem.fecha_ultimo_recambio + timedelta(days=elem.frecuencia_recambio_dias)
        dias_restantes = (fecha_vencimiento - hoy).days

        if dias_restantes <= 0:
            notificaciones.append(
                NotificacionResponse(
                    id_notificacion=f"elem-{elem.id}",
                    tipo="ELEMENTO_LIMPIEZA",
                    entidad_id=elem.id,
                    titulo="Recambio de Elemento Vencido",
                    mensaje=f"El elemento '{elem.nombre}' superó su frecuencia de recambio ({elem.frecuencia_recambio_dias} días).",
                    nivel="VENCIDO",
                    link_destino="/elementos-limpieza",
                    fecha_referencia=fecha_vencimiento,
                )
            )
        elif dias_restantes <= MARGEN_DIAS_ALERTA:
            notificaciones.append(
                NotificacionResponse(
                    id_notificacion=f"elem-{elem.id}",
                    tipo="ELEMENTO_LIMPIEZA",
                    entidad_id=elem.id,
                    titulo="Recambio Próximo a Vencer",
                    mensaje=f"El elemento '{elem.nombre}' requiere recambio en {dias_restantes} día(s).",
                    nivel="PROXIMO_A_VENCER",
                    link_destino="/elementos-limpieza",
                    fecha_referencia=fecha_vencimiento,
                )
            )

    return notificaciones


def obtener_notificaciones_planes_calibracion_mantenimiento(
    db: Session,
) -> List[NotificacionResponse]:
    notificaciones: List[NotificacionResponse] = []
    planes = db.scalars(
        select(PlanCalibracionMantenimiento)
        .join(Equipo)
        .options(selectinload(PlanCalibracionMantenimiento.equipo))
        .where(
            PlanCalibracionMantenimiento.activo.is_(True),
            Equipo.activo.is_(True),
        )
    ).all()

    for plan in planes:
        fecha_vencimiento = plan.proxima_fecha_vencimiento
        dias_restantes = plan.dias_restantes
        es_calibracion = plan.tipo == "calibracion"
        tipo_intervencion = "Calibración" if es_calibracion else "Mantenimiento"
        articulo_intervencion = "La calibración" if es_calibracion else "El mantenimiento"

        if dias_restantes <= 0:
            sufijo = "vencida" if es_calibracion else "vencido"
            mensaje = (
                f"{articulo_intervencion} del equipo '{plan.equipo.nombre}' "
                f"venció el {fecha_vencimiento}."
            )
            nivel = "VENCIDO"
        elif dias_restantes <= MARGEN_DIAS_ALERTA:
            mensaje = (
                f"{articulo_intervencion} del equipo '{plan.equipo.nombre}' "
                f"vence en {dias_restantes} día(s)."
            )
            sufijo = "próxima a vencer"
            nivel = "PROXIMO_A_VENCER"
        else:
            continue

        notificaciones.append(
            NotificacionResponse(
                id_notificacion=f"plan-calibracion-mantenimiento-{plan.id}",
                tipo="PLAN_CALIBRACION" if es_calibracion else "PLAN_MANTENIMIENTO",
                entidad_id=plan.id,
                titulo=f"{tipo_intervencion} {sufijo}",
                mensaje=mensaje,
                nivel=nivel,
                link_destino=(
                    f"/equipos/{plan.equipo.id}/intervencion"
                ),
                fecha_referencia=fecha_vencimiento,
            )
        )

    return notificaciones

def obtener_dias_alerta_vencimiento_personal(db: Session) -> int:
    config = db.get(ConfiguracionAlerta, CLAVE_DIAS_VENCIMIENTO_PERSONAL)
    return config.valor if config else DIAS_VENCIMIENTO_PERSONAL_POR_DEFECTO


def actualizar_dias_alerta_vencimiento_personal(db: Session, dias: int) -> int:
    config = db.get(ConfiguracionAlerta, CLAVE_DIAS_VENCIMIENTO_PERSONAL)
    if config:
        config.valor = dias
    else:
        db.add(ConfiguracionAlerta(clave=CLAVE_DIAS_VENCIMIENTO_PERSONAL, valor=dias))
    db.commit()
    return dias


def _nombre_persona(persona: Personal) -> str:
    return f"{persona.nombre} {persona.apellido or ''}".strip()

def obtener_notificaciones_vencimientos_personal(db: Session) -> List[NotificacionResponse]:
    notificaciones: List[NotificacionResponse] = []
    hoy = date.today()
    dias_alerta = obtener_dias_alerta_vencimiento_personal(db)
    limite = hoy + timedelta(days=dias_alerta)

    vencimientos = db.scalars(
        select(VencimientoPersonal)
        .join(Personal, VencimientoPersonal.persona_id == Personal.id)
        .join(Aptitud, VencimientoPersonal.aptitud_id == Aptitud.id)
        .options(
            selectinload(VencimientoPersonal.persona),
            selectinload(VencimientoPersonal.aptitud),
        )
        .where(
            VencimientoPersonal.activo.is_(True),
            Personal.activo.is_(True),
            Aptitud.activo.is_(True),
            VencimientoPersonal.fecha_vencimiento <= limite,
        )
        .order_by(VencimientoPersonal.fecha_vencimiento)
    ).all()

    for venc in vencimientos:
        persona = _nombre_persona(venc.persona)
        aptitud = venc.aptitud.nombre
        dias_restantes = (venc.fecha_vencimiento - hoy).days

        if dias_restantes <= 0:
            titulo = "Vencimiento de Personal Vencido"
            mensaje = f"'{aptitud}' de {persona} venció el {venc.fecha_vencimiento:%d/%m/%Y}."
            nivel = "VENCIDO"
        else:
            titulo = "Vencimiento de Personal Próximo a Vencer"
            mensaje = f"'{aptitud}' de {persona} vence en {dias_restantes} día(s)."
            nivel = "PROXIMO_A_VENCER"

        notificaciones.append(
            NotificacionResponse(
                id_notificacion=f"vencimiento-personal-{venc.id}",
                tipo="VENCIMIENTO_PERSONAL",
                entidad_id=venc.id,          # <- id del vencimiento
                titulo=titulo,
                mensaje=mensaje,
                nivel=nivel,
                link_destino=f"/personal/detalle/{venc.persona_id}",
                fecha_referencia=venc.fecha_vencimiento,
            )
        )

    return notificaciones


def _filtrar_por_texto(
    notificaciones: List[NotificacionResponse], buscar: str | None
) -> List[NotificacionResponse]:
    """Deja las notificaciones cuyo título o mensaje contiene el término
    (mayúsculas y tildes insensibles). Lo comparten el camino paginado y el
    completo, para que la búsqueda signifique lo mismo en ambos."""
    if not (buscar and buscar.strip()):
        return notificaciones

    termino = _normalizar_texto(buscar.strip())
    return [
        n
        for n in notificaciones
        if termino in _normalizar_texto(n.titulo)
        or termino in _normalizar_texto(n.mensaje)
    ]


def obtener_todas_notificaciones(
    db: Session, buscar: str | None = None
) -> List[NotificacionResponse]:
    """Consolidado completo: lo usa la campana del navbar y el camino sin
    paginar del router.

    `buscar` se aplica con la misma lógica que en el camino paginado: antes
    el router lo descartaba en silencio cuando no venía `page`, y quien lo
    mandaba recibía la lista completa sin filtrar.
    """
    lista_total: List[NotificacionResponse] = []
    lista_total.extend(obtener_notificaciones_elementos_limpieza(db))
    lista_total.extend(obtener_notificaciones_planes_calibracion_mantenimiento(db))
    lista_total.extend(obtener_notificaciones_vencimientos_personal(db))
    lista_total.sort(key=lambda x: 0 if x.nivel == "VENCIDO" else 1)
    return _filtrar_por_texto(lista_total, buscar)


# ────────────────────────── Listado paginado ──────────────────────────────
#
# El centro de notificaciones antes traía TODAS las alertas y filtraba,
# ordenaba y contaba en el navegador. Acá vive toda esa lógica: la
# consolidación sigue siendo en Python (mezcla tres tablas y fechas
# calculadas), pero el recorte sale del servidor y el frontend solo recibe
# una página.


def _normalizar_texto(texto: str) -> str:
    """Minúsculas y sin tildes: mismo criterio de búsqueda que tenía el
    frontend ('calibracion' encuentra 'Calibración')."""
    import unicodedata

    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )


_ORDENES = (
    "urgencia",
    "estado_asc",
    "estado_desc",
    "vencimiento_asc",
    "vencimiento_desc",
    "origen_asc",
    "origen_desc",
)

_TIPOS_ORIGEN = (
    "ELEMENTO_LIMPIEZA",
    "VENCIMIENTO_PERSONAL",
    "PLAN_CALIBRACION",
    "PLAN_MANTENIMIENTO",
)


def _ordenar(notificaciones: List[NotificacionResponse], orden: str) -> None:
    """Ordena EN EL LUGAR con el criterio pedido.

    `urgencia` (el default histórico) deja los VENCIDOS arriba sin tocar el
    orden relativo del resto; el resto son ordenamientos por columna.
    """
    if orden in ("urgencia", "estado_asc"):
        notificaciones.sort(key=lambda n: 0 if n.nivel == "VENCIDO" else 1)
    elif orden == "estado_desc":
        notificaciones.sort(key=lambda n: 1 if n.nivel == "VENCIDO" else 0)
    elif orden in ("vencimiento_asc", "vencimiento_desc"):
        # Sin fecha (no debería pasar) queda al final en ascendente.
        epoca_min = date.min
        notificaciones.sort(
            key=lambda n: n.fecha_referencia or epoca_min,
            reverse=(orden == "vencimiento_desc"),
        )
    elif orden in ("origen_asc", "origen_desc"):
        notificaciones.sort(
            key=lambda n: n.tipo,
            reverse=(orden == "origen_desc"),
        )


def obtener_notificaciones_paginadas(
    db: Session,
    buscar: str | None,
    urgencia: str | None,
    origen: str | None,
    orden: str | None,
    page: int,
    page_size: int,
) -> tuple[List[NotificacionResponse], int, dict]:
    """Filtra, ordena, corta la página y calcula los contadores de los filtros.

    Devuelve `(items, total, contadores)`. Los contadores replican la regla
    que estaba en el frontend: el contador de cada dropdown ignora SU propio
    filtro pero respeta el otro y la búsqueda.

    NOTA DE DISEÑO — paginación EN MEMORIA, a propósito: el consolidado
    mezcla tres fuentes (elementos de limpieza, planes de calibración/
    mantenimiento y vencimientos de personal) con el nivel de urgencia
    calculado en Python a partir de fechas comparadas contra hoy, y los
    `contadores` de los dropdowns exigen el conjunto completo. No hay una
    sola tabla contra la cual hacer COUNT + OFFSET/LIMIT: se leen todas las
    filas de las tres fuentes, se consolidan, y recién ahí se filtra,
    ordena y recorta la página. El recorte en Python acota lo que VIAJA al
    cliente, no lo que se lee de la base; convertirlo a SQL exigiría
    duplicar la lógica de fechas/estados por fuente (o materializar las
    alertas en una tabla), y no se justifica para el volumen de un
    laboratorio.
    """
    if orden not in _ORDENES:
        orden = "urgencia"
    if urgencia not in ("todas", "vencidas", "proximas"):
        urgencia = "todas"
    if origen not in ("todas",) + _TIPOS_ORIGEN:
        origen = "todas"

    notificaciones = obtener_todas_notificaciones(db)

    # 1) Búsqueda: se aplica a todo, contadores incluidos.
    notificaciones = _filtrar_por_texto(notificaciones, buscar)

    def por_urgencia(lista: List[NotificacionResponse], valor: str) -> List:
        if valor == "vencidas":
            return [n for n in lista if n.nivel == "VENCIDO"]
        if valor == "proximas":
            return [n for n in lista if n.nivel == "PROXIMO_A_VENCER"]
        return lista

    def por_origen(lista: List[NotificacionResponse], valor: str) -> List:
        if valor != "todas":
            return [n for n in lista if n.tipo == valor]
        return lista

    # 2) Contadores de urgencia: ignoran el filtro de urgencia.
    base_urgencia = por_origen(notificaciones, origen)
    contadores = {
        "urgencia": {
            "todas": len(base_urgencia),
            "vencidas": len(por_urgencia(base_urgencia, "vencidas")),
            "proximas": len(por_urgencia(base_urgencia, "proximas")),
        }
    }

    # 3) Contadores de origen: ignoran el filtro de origen.
    base_origen = por_urgencia(notificaciones, urgencia)
    contadores["origen"] = {
        "todas": len(base_origen),
        **{tipo: len(por_origen(base_origen, tipo)) for tipo in _TIPOS_ORIGEN},
    }

    # 4) Filas de la tabla: con los dos filtros aplicados.
    filtradas = por_urgencia(por_origen(notificaciones, origen), urgencia)
    _ordenar(filtradas, orden)

    total = len(filtradas)
    inicio = (page - 1) * page_size
    return filtradas[inicio : inicio + page_size], total, contadores
