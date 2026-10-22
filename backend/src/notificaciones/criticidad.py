from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.checklist import services as checklist_services
from src.checklist.models import Checklist
from src.documentos.models import Documento
from src.incidente.constants import EstadoIncidente
from src.incidente.models import Incidente
from src.notificaciones import services as notificacion_services
from src.notificaciones.schemas import (
    AlertaCriticidadResponse,
    CriticidadDashboardResponse,
)
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento


REGLAS_BASE = {
    "INCIDENTE_ABIERTO": "alta",

    "ELEMENTO_LIMPIEZA_VENCIDO": "media",
    "ELEMENTO_LIMPIEZA_PROXIMO": "baja",

    "PLAN_CALIBRACION_VENCIDO": "media",
    "PLAN_CALIBRACION_PROXIMO": "baja",

    "PLAN_MANTENIMIENTO_VENCIDO": "media",
    "PLAN_MANTENIMIENTO_PROXIMO": "baja",

    "VENCIMIENTO_PERSONAL_VENCIDO": "media",
    "VENCIMIENTO_PERSONAL_PROXIMO": "baja",

    "DOCUMENTO_VENCIDO": "media",
    "DOCUMENTO_PROXIMO": "baja",

    "CHECKLIST_INCOMPLETO": "baja",
}


DIAS_RECURRENCIA = 30
UMBRAL_RECURRENCIA = 3
DIAS_DOCUMENTO_PROXIMO = 15


ORDEN_CRITICIDAD = {
    "alta": 3,
    "media": 2,
    "baja": 1,
}


ICONOS = {
    "ELEMENTO_LIMPIEZA": "limpieza",
    "PLAN_CALIBRACION": "calibracion",
    "PLAN_MANTENIMIENTO": "calibracion",
    "VENCIMIENTO_PERSONAL": "personal",
    "DOCUMENTO": "documento",
    "CHECKLIST": "checklist",
    "INCIDENTE": "incidente",
}



def _subir(criticidad: str) -> str:
    """Sube un nivel de criticidad sin superar ALTA."""

    if criticidad == "baja":
        return "media"

    if criticidad == "media":
        return "alta"

    return "alta"


def _plazo(fecha: date | None, hoy: date) -> str:
    if fecha is None:
        return "Sin fecha"

    dias = (fecha - hoy).days

    if dias < 0:
        cantidad = -dias
        return f"hace {cantidad} {'día' if cantidad == 1 else 'días'}"

    if dias == 0:
        return "vence hoy"

    if dias == 1:
        return "vence mañana"

    return f"vence en {dias} días"


def _motivo_base(tipo_regla: str) -> str:
    return {
        "INCIDENTE_ABIERTO": "Incidente abierto",

        "ELEMENTO_LIMPIEZA_VENCIDO": "Recambio vencido",
        "ELEMENTO_LIMPIEZA_PROXIMO": "Recambio próximo a vencer",

        "PLAN_CALIBRACION_VENCIDO": "Calibración vencida",
        "PLAN_CALIBRACION_PROXIMO": "Calibración próxima a vencer",

        "PLAN_MANTENIMIENTO_VENCIDO": "Mantenimiento vencido",
        "PLAN_MANTENIMIENTO_PROXIMO": "Mantenimiento próximo a vencer",

        "VENCIMIENTO_PERSONAL_VENCIDO": "Aptitud vencida",
        "VENCIMIENTO_PERSONAL_PROXIMO": "Aptitud próxima a vencer",

        "DOCUMENTO_VENCIDO": "Documento vencido",
        "DOCUMENTO_PROXIMO": "Documento próximo a vencer",

        "CHECKLIST_INCOMPLETO": "Tareas de checklist pendientes",
    }[tipo_regla]


def _notificacion_regla(nivel: str, tipo: str) -> str:
    if tipo == "ELEMENTO_LIMPIEZA":
        return (
            "ELEMENTO_LIMPIEZA_VENCIDO"
            if nivel == "VENCIDO"
            else "ELEMENTO_LIMPIEZA_PROXIMO"
        )

    if tipo == "PLAN_CALIBRACION":
        return (
            "PLAN_CALIBRACION_VENCIDO"
            if nivel == "VENCIDO"
            else "PLAN_CALIBRACION_PROXIMO"
        )

    if tipo == "PLAN_MANTENIMIENTO":
        return (
            "PLAN_MANTENIMIENTO_VENCIDO"
            if nivel == "VENCIDO"
            else "PLAN_MANTENIMIENTO_PROXIMO"
        )

    if tipo == "VENCIMIENTO_PERSONAL":
        return (
            "VENCIMIENTO_PERSONAL_VENCIDO"
            if nivel == "VENCIDO"
            else "VENCIMIENTO_PERSONAL_PROXIMO"
        )

    raise ValueError(f"Tipo de notificación no contemplado: {tipo}")



def _agrupar_recurrencia_checklists(
    db: Session,
    desde: date,
) -> dict[str, int]:
    """
    Cuenta días en los que un equipo tuvo al menos una tarea incumplida.

    Cinco tareas incumplidas dentro del mismo checklist cuentan como una
    ocurrencia y no como cinco repeticiones artificiales.
    """

    checklists = db.scalars(
        select(Checklist)
        .options(selectinload(Checklist.registros))
        .where(Checklist.fecha >= desde)
    ).all()

    fechas_por_equipo: dict[int, set[date]] = defaultdict(set)

    for checklist in checklists:
        if any(
            not registro.completado
            for registro in checklist.registros
        ):
            fechas_por_equipo[checklist.equipo_id].add(
                checklist.fecha
            )

    return {
        f"equipo:{equipo_id}": len(fechas)
        for equipo_id, fechas in fechas_por_equipo.items()
    }


def _agrupar_recurrencia_incidentes(
    incidentes: Iterable[Incidente],
    desde: date,
) -> dict[str, int]:

    conteos: Counter[str] = Counter()

    for incidente in incidentes:
        if incidente.fecha_reporte.date() < desde:
            continue

        if incidente.equipo_id is not None:
            clave = f"equipo:{incidente.equipo_id}"
        else:
            clave = f"incidente-tipo:{incidente.tipo}"

        conteos[clave] += 1

    return dict(conteos)



def _crear_alerta(
    *,
    clave: str,
    origen: str,
    entidad_id: int,
    grupo_clave: str,
    icono: str,
    titulo: str,
    detalle: str,
    tipo_regla: str,
    fecha_referencia: date | None,
    destino: str,
    recambio_id: int | None = None,
) -> dict:

    return {
        "clave": clave,
        "origen": origen,
        "entidad_id": entidad_id,
        "grupo_clave": grupo_clave,
        "icono": icono,
        "titulo": titulo,
        "detalle": detalle,
        "tipo_regla": tipo_regla,
        "criticidad": REGLAS_BASE[tipo_regla],
        "motivo": _motivo_base(tipo_regla),
        "fecha_referencia": fecha_referencia,
        "destino": destino,
        "recambio_id": recambio_id,
    }



def obtener_panel_criticidad(
    db: Session,
) -> CriticidadDashboardResponse:

    hoy = date.today()
    desde = hoy - timedelta(days=DIAS_RECURRENCIA)

    alertas: list[dict] = []


    for n in notificacion_services.obtener_todas_notificaciones(db):

        grupo = (
            n.grupo_clave
            or f"{n.tipo}:{n.entidad_id}"
        )

        alertas.append(
            _crear_alerta(
                clave=f"notificacion-{n.id_notificacion}",
                origen=n.tipo,
                entidad_id=n.entidad_id,
                grupo_clave=grupo,
                icono=ICONOS.get(n.tipo, "documento"),
                titulo=n.titulo,
                detalle=n.mensaje,
                tipo_regla=_notificacion_regla(
                    n.nivel,
                    n.tipo,
                ),
                fecha_referencia=n.fecha_referencia,
                destino=n.link_destino,
                recambio_id=(
                    n.entidad_id
                    if n.tipo == "ELEMENTO_LIMPIEZA"
                    else None
                ),
            )
        )


    documentos = db.scalars(
        select(Documento)
        .options(selectinload(Documento.versiones))
    ).all()

    for documento in documentos:

        version = documento.version_vigente

        if (
            version is None
            or version.fecha_vencimiento is None
        ):
            continue

        dias = (
            version.fecha_vencimiento - hoy
        ).days

        if dias < 0:
            tipo_regla = "DOCUMENTO_VENCIDO"

        elif dias <= DIAS_DOCUMENTO_PROXIMO:
            tipo_regla = "DOCUMENTO_PROXIMO"

        else:
            continue

        alertas.append(
            _crear_alerta(
                clave=f"documento-{documento.id}",
                origen="DOCUMENTO",
                entidad_id=documento.id,
                grupo_clave=f"documento:{documento.id}",
                icono="documento",
                titulo=(
                    "Documento vencido"
                    if tipo_regla == "DOCUMENTO_VENCIDO"
                    else "Documento próximo a vencer"
                ),
                detalle=(
                    f"{documento.nombre} · "
                    f"versión {version.numero_version}"
                ),
                tipo_regla=tipo_regla,
                fecha_referencia=version.fecha_vencimiento,
                destino=f"/documentos/{documento.id}",
            )
        )


    tareas_hoy = checklist_services.listar_tareas_del_dia(
        db,
        hoy,
    )

    pendientes_por_equipo: dict[int, list[str]] = defaultdict(list)

    for tarea in tareas_hoy.tareas:

        if not tarea.completado:
            pendientes_por_equipo[
                tarea.equipo_id
            ].append(tarea.nombre)

    nombres_equipo = {
        equipo_id: next(
            (
                tarea.equipo_nombre
                for tarea in tareas_hoy.tareas
                if tarea.equipo_id == equipo_id
            ),
            f"Equipo {equipo_id}",
        )
        for equipo_id in pendientes_por_equipo
    }

    for equipo_id, pendientes in pendientes_por_equipo.items():

        alertas.append(
            _crear_alerta(
                clave=f"checklist-equipo-{equipo_id}",
                origen="CHECKLIST",
                entidad_id=equipo_id,
                grupo_clave=f"equipo:{equipo_id}",
                icono="checklist",
                titulo="Checklist incompleto",
                detalle=(
                    f"{nombres_equipo[equipo_id]} · "
                    f"{len(pendientes)} tarea(s) pendiente(s)"
                ),
                tipo_regla="CHECKLIST_INCOMPLETO",
                fecha_referencia=hoy,
                destino="/checklist/historial",
            )
        )


    incidentes = db.scalars(
        select(Incidente)
    ).all()

    for incidente in incidentes:

        if incidente.estado != EstadoIncidente.ABIERTO.value:
            continue

        grupo = (
            f"equipo:{incidente.equipo_id}"
            if incidente.equipo_id is not None
            else f"incidente-tipo:{incidente.tipo}"
        )

        alertas.append(
            _crear_alerta(
                clave=f"incidente-{incidente.id}",
                origen="INCIDENTE",
                entidad_id=incidente.id,
                grupo_clave=grupo,
                icono="incidente",
                titulo=incidente.titulo,
                detalle=incidente.descripcion,
                tipo_regla="INCIDENTE_ABIERTO",
                fecha_referencia=incidente.fecha_reporte.date(),
                destino=f"/incidentes/{incidente.id}",
            )
        )

 
    cantidad_por_grupo = Counter(
        alerta["grupo_clave"]
        for alerta in alertas
    )

    recurrencia = _agrupar_recurrencia_incidentes(
        incidentes,
        desde,
    )

    recurrencia_checklists = (
        _agrupar_recurrencia_checklists(
            db,
            desde,
        )
    )

    for grupo, cantidad in recurrencia_checklists.items():

        recurrencia[grupo] = max(
            recurrencia.get(grupo, 0),
            cantidad,
        )

    # --------------------------------------------------------
    # 6. APLICAR ELEVACIONES
    # --------------------------------------------------------

    for alerta in alertas:

        elevaciones: list[str] = []

        # Regla 1
        if cantidad_por_grupo[
            alerta["grupo_clave"]
        ] >= 2:

            alerta["criticidad"] = _subir(
                alerta["criticidad"]
            )

            elevaciones.append(
                "varias situaciones sobre el mismo elemento"
            )

        # Regla 2
        cantidad_recurrente = recurrencia.get(
            alerta["grupo_clave"],
            0,
        )

        if cantidad_recurrente >= UMBRAL_RECURRENCIA:

            alerta["criticidad"] = _subir(
                alerta["criticidad"]
            )

            elevaciones.append(
                f"recurrencia de {cantidad_recurrente} "
                f"ocurrencias en {DIAS_RECURRENCIA} días"
            )

        if elevaciones:
            alerta["motivo"] = (
                f"{alerta['motivo']}; "
                + "; ".join(elevaciones)
            )

        alerta["plazo"] = _plazo(
            alerta["fecha_referencia"],
            hoy,
        )

    # --------------------------------------------------------
    # 7. PRIORIZACIÓN
    # --------------------------------------------------------

    alertas.sort(
        key=lambda alerta: (
            -ORDEN_CRITICIDAD[
                alerta["criticidad"]
            ],
            alerta["fecha_referencia"] is None,
            alerta["fecha_referencia"] or date.max,
        )
    )

    # --------------------------------------------------------
    # 8. NIVEL GENERAL
    # --------------------------------------------------------

    resumen = Counter(
        alerta["criticidad"]
        for alerta in alertas
    )

    # No hacemos promedio:
    # una situación ALTA no puede ser compensada por muchas BAJAS.
    if resumen["alta"] > 0:
        nivel_general = "alto"

    elif resumen["media"] > 0:
        nivel_general = "medio"

    else:
        nivel_general = "bajo"

    respuesta = [
        AlertaCriticidadResponse(
            clave=alerta["clave"],
            origen=alerta["origen"],
            entidad_id=alerta["entidad_id"],
            grupo_clave=alerta["grupo_clave"],
            icono=alerta["icono"],
            titulo=alerta["titulo"],
            detalle=alerta["detalle"],
            criticidad=alerta["criticidad"],
            motivo=alerta["motivo"],
            plazo=alerta["plazo"],
            destino=alerta["destino"],
            recambio_id=alerta["recambio_id"],
        )
        for alerta in alertas
    ]

    return CriticidadDashboardResponse(
        nivel_general=nivel_general,
        total=len(respuesta),
        altas=resumen["alta"],
        medias=resumen["media"],
        bajas=resumen["baja"],
        alertas=respuesta,
    )
