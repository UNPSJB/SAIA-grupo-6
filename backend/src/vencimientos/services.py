from datetime import date
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from datetime import date, datetime

from src.aptitud.models import Aptitud
from src.Equipo.models import Equipo
from src.common.texto import coincide_terminos, normalizar_texto
from src.notificaciones.services import (
    MARGEN_DIAS_ALERTA,
    obtener_dias_alerta_vencimiento_personal,
)
from src.personal.models import Personal
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento
from src.vencimientos import schemas
from src.vencimientos.schemas import VencimientoConsolidadoResponse
from src.vencimientoPersonal.models import VencimientoPersonal
from src.documentos.models import VersionDocumento

# Orden de urgencia: primero los vencidos, después los próximos, al final los vigentes.
_ORDEN_ESTADO = {"VENCIDO": 0, "PROXIMO": 1, "VIGENTE": 2}

# Etiqueta visible de cada tipo de vencimiento. El orden por "Tipo" usa esta
# etiqueta (y no la clave interna) para que coincida con lo que muestra la
# tabla: Calibración, Documento, Mantenimiento, Personal.
_ETIQUETA_TIPO = {
    "PERSONAL": "Personal",
    "CALIBRACION": "Calibración",
    "MANTENIMIENTO": "Mantenimiento",
    "DOCUMENTO": "Documento",
}


def _estado(dias_restantes: int, margen: int) -> str:
    # Mismo criterio que las notificaciones: hoy o antes ya cuenta como vencido.
    if dias_restantes <= 0:
        return "VENCIDO"
    if dias_restantes <= margen:
        return "PROXIMO"
    return "VIGENTE"


def _nombre_persona(persona: Personal) -> str:
    return f"{persona.nombre} {persona.apellido or ''}".strip()


def _vencimientos_personal(db: Session) -> List[VencimientoConsolidadoResponse]:
    hoy = date.today()
    margen = obtener_dias_alerta_vencimiento_personal(db)

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
        )
    ).all()

    resultado = []
    for venc in vencimientos:
        dias = (venc.fecha_vencimiento - hoy).days
        resultado.append(
            VencimientoConsolidadoResponse(
                id_vencimiento=f"personal-{venc.id}",
                tipo="PERSONAL",
                entidad_id=venc.id,
                sujeto_id=venc.persona_id,
                detalle=venc.aptitud.nombre,
                sujeto=_nombre_persona(venc.persona),
                fecha_vencimiento=venc.fecha_vencimiento,
                dias_restantes=dias,
                estado=_estado(dias, margen),
                link_destino=f"/personal/detalle/{venc.persona_id}",
            )
        )
    return resultado


def _vencimientos_equipos(
    db: Session, tipo: Optional[str]
) -> List[VencimientoConsolidadoResponse]:
    consulta = (
        select(PlanCalibracionMantenimiento)
        .join(Equipo)
        .options(selectinload(PlanCalibracionMantenimiento.equipo))
        .where(
            PlanCalibracionMantenimiento.activo.is_(True),
            Equipo.activo.is_(True),
        )
    )
    # En la base el tipo se guarda en minúscula: "calibracion" / "mantenimiento".
    if tipo:
        consulta = consulta.where(PlanCalibracionMantenimiento.tipo == tipo.lower())

    resultado = []
    for plan in db.scalars(consulta).all():
        dias = plan.dias_restantes
        es_calibracion = plan.tipo == "calibracion"
        resultado.append(
            VencimientoConsolidadoResponse(
                id_vencimiento=f"plan-{plan.id}",
                tipo="CALIBRACION" if es_calibracion else "MANTENIMIENTO",
                entidad_id=plan.id,
                sujeto_id=plan.equipo.id,
                detalle="Calibración" if es_calibracion else "Mantenimiento",
                sujeto=plan.equipo.nombre,
                fecha_vencimiento=plan.proxima_fecha_vencimiento,
                dias_restantes=dias,
                estado=_estado(dias, MARGEN_DIAS_ALERTA),
                link_destino=f"/equipos/detalle/{plan.equipo.id}",
            )
        )
    return resultado

# Los tipos se guardan como clave ("manual_bpm"); en pantalla va el nombre legible.
_ETIQUETA_TIPO_DOCUMENTO = {
    "manual_bpm": "Manual de BPM",
    "ficha_tecnica": "Ficha técnica",
    "procedimiento": "Procedimiento",
    "receta": "Receta",
}


def _vencimientos_documentos(db: Session) -> List[VencimientoConsolidadoResponse]:
    hoy = date.today()
    # Los documentos usan el mismo margen configurable que el personal (15 días por defecto).
    margen = obtener_dias_alerta_vencimiento_personal(db)

    # Solo cuenta la versión vigente: una versión archivada ya no rige.
    versiones = db.scalars(
        select(VersionDocumento)
        .options(selectinload(VersionDocumento.documento))
        .where(
            VersionDocumento.vigente.is_(True),
            VersionDocumento.fecha_vencimiento.is_not(None),  # <- AJUSTAR
        )
    ).all()

    resultado = []
    for version in versiones:
        fecha = version.fecha_vencimiento  # <- AJUSTAR
        if isinstance(fecha, datetime):  # por si la columna guarda fecha y hora
            fecha = fecha.date()

        documento = version.documento
        dias = (fecha - hoy).days
        resultado.append(
            VencimientoConsolidadoResponse(
                id_vencimiento=f"documento-{version.id}",
                tipo="DOCUMENTO",
                entidad_id=documento.id,
                sujeto_id=documento.id,
                detalle=_ETIQUETA_TIPO_DOCUMENTO.get(documento.tipo, documento.tipo),
                sujeto=documento.nombre,
                fecha_vencimiento=fecha,
                dias_restantes=dias,
                estado=_estado(dias, margen),
                link_destino=f"/documentos/{documento.id}/historial",
            )
        )
    return resultado

def listar_vencimientos(
    db: Session, tipo: Optional[str] = None
) -> List[VencimientoConsolidadoResponse]:
    """Junta todas las fuentes de vencimientos en una sola lista ordenada por urgencia.

    Para sumar una fuente nueva (por ejemplo documentos, cuando tengan fecha de
    vencimiento) alcanza con escribir otra función como las de arriba y agregarla acá.
    """
    items: List[VencimientoConsolidadoResponse] = []

    if tipo in (None, "PERSONAL"):
        items.extend(_vencimientos_personal(db))
    if tipo in (None, "CALIBRACION", "MANTENIMIENTO"):
        items.extend(_vencimientos_equipos(db, tipo))
    if tipo in (None, "DOCUMENTO"):
        items.extend(_vencimientos_documentos(db))

    # Primero por estado y, dentro de cada estado, el más urgente (menos días) arriba.
    items.sort(key=lambda v: (_ORDEN_ESTADO[v.estado], v.dias_restantes))
    return items


# ────────────────────────── Listado paginado ──────────────────────────────


def _ordenar_vencimientos(
    items: List[VencimientoConsolidadoResponse], orden: str
) -> None:
    """Ordena EN EL LUGAR con el criterio pedido.

    `URGENCIA` (default histórico) y `estado_asc` son equivalentes: VENCIDO →
    PRÓXIMO → VIGENTE y, dentro de cada estado, el más urgente primero.
    `VIGENTES_PRIMERO` y `estado_desc` invierten el orden de los estados sin
    perder la urgencia dentro de cada uno. El desempate por
    `id_vencimiento` mantiene estable el OFFSET/LIMIT entre páginas.
    """
    if orden in ("VIGENTES_PRIMERO", "estado_desc"):
        items.sort(
            key=lambda v: (
                -_ORDEN_ESTADO[v.estado],
                v.dias_restantes,
                v.id_vencimiento,
            )
        )
    elif orden in ("tipo_asc", "tipo_desc"):
        items.sort(
            key=lambda v: (
                normalizar_texto(_ETIQUETA_TIPO.get(v.tipo, v.tipo)),
                v.dias_restantes,
                v.id_vencimiento,
            ),
            reverse=(orden == "tipo_desc"),
        )
    elif orden in ("vencimiento_asc", "vencimiento_desc"):
        items.sort(
            key=lambda v: (v.fecha_vencimiento, v.id_vencimiento),
            reverse=(orden == "vencimiento_desc"),
        )
    else:  # URGENCIA / estado_asc
        items.sort(
            key=lambda v: (
                _ORDEN_ESTADO[v.estado],
                v.dias_restantes,
                v.id_vencimiento,
            )
        )


def listar_vencimientos_paginado(
    db: Session,
    tipo: Optional[str],
    persona_id: Optional[int],
    aptitud: Optional[str],
    estado: Optional[str],
    buscar: Optional[str],
    orden: Optional[str],
    page: int,
    page_size: int,
) -> tuple[List[VencimientoConsolidadoResponse], int]:
    """Los mismos filtros que tenía el frontend, aplicados server-side.

    `orden` acepta las dos opciones históricas del selector (URGENCIA,
    VIGENTES_PRIMERO) y las claves de columna que usa el encabezado
    ordenable (estado, tipo y vencimiento).

    NOTA DE DISEÑO — paginación EN MEMORIA, a propósito: igual que el centro
    de notificaciones, este listado es un CONSOLIDADO de cuatro fuentes
    (vencimientos de personal, planes de calibración, planes de
    mantenimiento y versiones de documentos) con el `estado` calculado en
    Python contra la fecha de hoy y el margen configurable. No hay una tabla
    única contra la cual hacer COUNT + OFFSET/LIMIT: se consolidan todas las
    filas y recién ahí se filtra, ordena y recorta. El recorte acota lo que
    VIAJA al cliente, no lo que se lee de la base.
    """
    items = listar_vencimientos(db, tipo)

    if persona_id is not None:
        items = [v for v in items if v.sujeto_id == persona_id and v.tipo == "PERSONAL"]
    if aptitud:
        items = [v for v in items if v.detalle == aptitud]
    if estado:
        items = [v for v in items if v.estado == estado]

    if buscar and buscar.strip():
        # Misma regla que el resto de los consolidados (`coincide_terminos`):
        # cada palabra tiene que aparecer en algún campo, sin importar el orden
        # ni las tildes ("equipo vencimiento" encuentra "Équipo vencimiento").
        items = [
            v
            for v in items
            if coincide_terminos(
                (
                    v.detalle,
                    v.sujeto,
                    v.estado,
                    v.tipo,
                    _ETIQUETA_TIPO.get(v.tipo, v.tipo),
                    str(v.fecha_vencimiento),
                ),
                buscar,
            )
        ]

    _ordenar_vencimientos(items, orden or "URGENCIA")

    total = len(items)
    inicio = (page - 1) * page_size
    return items[inicio : inicio + page_size], total


def listar_opciones_vencimientos(db: Session) -> schemas.VencimientosOpcionesResponse:
    """Personas y aptitudes que tienen al menos un vencimiento activo.

    Es lo que alimentaba el filtro de la tabla cuando el frontend cargaba
    TODO el consolidado; con la paginación en el servidor hace falta un
    endpoint liviano para llenar los dropdowns.
    """
    personas: dict[int, str] = {}
    aptitudes: set[str] = set()
    for v in _vencimientos_personal(db):
        personas.setdefault(v.sujeto_id, v.sujeto)
        aptitudes.add(v.detalle)

    return schemas.VencimientosOpcionesResponse(
        personas=[
            schemas.OpcionPersona(id=id_, nombre=nombre)
            for id_, nombre in sorted(personas.items(), key=lambda par: par[1])
        ],
        aptitudes=sorted(aptitudes),
    )