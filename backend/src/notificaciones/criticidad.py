from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.checklist.models import Checklist
from src.documentos.models import Documento
from src.incidente.constants import EstadoIncidente
from src.incidente.models import Incidente
from src.notificaciones import services as notificacion_services
from src.notificaciones.schemas import (
    AlertaCriticidadResponse,
    CriticidadDashboardResponse,
)


# ============================================================
# REGLAS BASE DEL MOTOR
# ============================================================

REGLAS_BASE: dict[str, str] = {
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

ORDEN_CRITICIDAD = {"alta": 3, "media": 2, "baja": 1}

DIAS_RECURRENCIA = 30
UMBRAL_RECURRENCIA = 3
DIAS_DOCUMENTO_PROXIMO = 15

ICONOS = {
    "ELEMENTO_LIMPIEZA": "limpieza",
    "PLAN_CALIBRACION": "calibracion",
    "PLAN_MANTENIMIENTO": "calibracion",
    "VENCIMIENTO_PERSONAL": "personal",
    "DOCUMENTO": "documento",
    "CHECKLIST": "checklist",
    "INCIDENTE": "incidente",
}


# ============================================================
# UTILIDADES
# ============================================================

def _subir(criticidad: str) -> str:
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


def _regla_notificacion(tipo: str, nivel: str) -> str:
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


def _motivo_base(regla: str) -> str:
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
        "CHECKLIST_INCOMPLETO": "Tarea de checklist incumplida",
    }[regla]


def _crear_alerta(
    *,
    clave: str,
    origen: str,
    entidad_id: int,
    grupo_clave: str,
    titulo: str,
    detalle: str,
    regla: str,
    fecha_referencia: date | None,
    destino: str,
    recambio_id: int | None = None,
) -> dict[str, Any]:
    return {
        "clave": clave,
        "origen": origen,
        "entidad_id": entidad_id,
        "grupo_clave": grupo_clave,
        "icono": ICONOS[origen],
        "titulo": titulo,
        "detalle": detalle,
        "regla": regla,
        "criticidad": REGLAS_BASE[regla],
        "motivo": _motivo_base(regla),
        "fecha_referencia": fecha_referencia,
        "destino": destino,
        "recambio_id": recambio_id,
    }


# ============================================================
# RECURRENCIA
# ============================================================

def _recurrencia_incidentes(
    incidentes: list[Incidente],
    desde: date,
) -> Counter[str]:
    conteos: Counter[str] = Counter()

    for incidente in incidentes:
        if incidente.fecha_reporte.date() < desde:
            continue

        if incidente.equipo_id is not None:
            grupo = f"equipo:{incidente.equipo_id}"
        else:
            grupo = f"incidente-tipo:{incidente.tipo}"

        conteos[grupo] += 1

    return conteos


def _recurrencia_checklists(
    db: Session,
    desde: date,
    hasta: date,
) -> Counter[str]:
    """Cuenta ocurrencias incumplidas durante los últimos 30 días.

    Si una tarea incumplida está vinculada a un elemento de limpieza,
    la recurrencia se agrupa por elemento. Si no, se agrupa por equipo.
    """

    checklists = db.scalars(
        select(Checklist)
        .options(selectinload(Checklist.registros))
        .where(
            Checklist.fecha >= desde,
            Checklist.fecha <= hasta,
        )
    ).all()

    fechas_por_grupo: dict[str, set[date]] = defaultdict(set)

    for checklist in checklists:
        for registro in checklist.registros:
            if registro.completado:
                continue

            if registro.elemento_limpieza_id is not None:
                grupo = f"elemento:{registro.elemento_limpieza_id}"
            else:
                grupo = f"equipo:{checklist.equipo_id}"

            # Varias tareas incumplidas del mismo elemento en un mismo día
            # representan una sola ocurrencia recurrente.
            fechas_por_grupo[grupo].add(checklist.fecha)

    return Counter({
        grupo: len(fechas)
        for grupo, fechas in fechas_por_grupo.items()
    })


# ============================================================
# MOTOR DE CRITICIDAD
# ============================================================

def obtener_criticidad_dashboard(
    db: Session,
) -> CriticidadDashboardResponse:
    hoy = date.today()
    desde = hoy - timedelta(days=DIAS_RECURRENCIA)

    alertas: list[dict[str, Any]] = []

    # --------------------------------------------------------
    # 1. VENCIMIENTOS EXISTENTES
    # --------------------------------------------------------
    for notificacion in notificacion_services.obtener_todas_notificaciones(db):
        grupo = notificacion.grupo_clave

        if grupo is None:
            if notificacion.tipo == "VENCIMIENTO_PERSONAL":
                # El backend de notificaciones usa entidad_id = vencimiento.
                # Recuperamos la persona desde la propia consulta específica
                # más abajo, por lo que este fallback solo evita perder la alerta.
                grupo = f"notificacion:{notificacion.entidad_id}"
            else:
                grupo = f"{notificacion.tipo}:{notificacion.entidad_id}"

        alertas.append(
            _crear_alerta(
                clave=f"notificacion-{notificacion.id_notificacion}",
                origen=notificacion.tipo,
                entidad_id=notificacion.entidad_id,
                grupo_clave=grupo,
                titulo=notificacion.titulo,
                detalle=notificacion.mensaje,
                regla=_regla_notificacion(
                    notificacion.tipo,
                    notificacion.nivel,
                ),
                fecha_referencia=notificacion.fecha_referencia,
                destino=notificacion.link_destino,
                recambio_id=(
                    notificacion.entidad_id
                    if notificacion.tipo == "ELEMENTO_LIMPIEZA"
                    else None
                ),
            )
        )

    # --------------------------------------------------------
    # 2. DOCUMENTOS
    # --------------------------------------------------------
    documentos = db.scalars(
        select(Documento).options(selectinload(Documento.versiones))
    ).all()

    for documento in documentos:
        version = documento.version_vigente
        if version is None or version.fecha_vencimiento is None:
            continue

        dias = (version.fecha_vencimiento - hoy).days

        if dias < 0:
            regla = "DOCUMENTO_VENCIDO"
            titulo = "Documento vencido"
        elif dias <= DIAS_DOCUMENTO_PROXIMO:
            regla = "DOCUMENTO_PROXIMO"
            titulo = "Documento próximo a vencer"
        else:
            continue

        alertas.append(
            _crear_alerta(
                clave=f"documento-{documento.id}",
                origen="DOCUMENTO",
                entidad_id=documento.id,
                grupo_clave=f"documento:{documento.id}",
                titulo=titulo,
                detalle=(
                    f"{documento.nombre} · versión {version.numero_version}"
                ),
                regla=regla,
                fecha_referencia=version.fecha_vencimiento,
                destino=f"/documentos/{documento.id}",
            )
        )

    # --------------------------------------------------------
    # 3. CHECKLISTS INCUMPLIDOS
    # --------------------------------------------------------
    checklists_historicos = db.scalars(
        select(Checklist)
        .options(
            selectinload(Checklist.registros),
            selectinload(Checklist.equipo),
        )
        .where(
            Checklist.fecha >= desde,
            Checklist.fecha <= hoy,
        )
    ).all()

    # Para el panel actual mostramos únicamente las situaciones vigentes de
    # hoy, mientras que todos los días del período se utilizan para recurrencia.
    for checklist in checklists_historicos:
        if checklist.fecha != hoy:
            continue

        for registro in checklist.registros:
            if registro.completado:
                continue

            if registro.elemento_limpieza_id is not None:
                grupo = f"elemento:{registro.elemento_limpieza_id}"
            else:
                grupo = f"equipo:{checklist.equipo_id}"

            detalle = checklist.equipo.nombre
            if registro.nombre_tarea_historico:
                detalle = f"{detalle} · {registro.nombre_tarea_historico}"

            alertas.append(
                _crear_alerta(
                    clave=f"checklist-registro-{registro.id}",
                    origen="CHECKLIST",
                    entidad_id=registro.id,
                    grupo_clave=grupo,
                    titulo="Tarea de checklist incumplida",
                    detalle=detalle,
                    regla="CHECKLIST_INCOMPLETO",
                    fecha_referencia=checklist.fecha,
                    destino="/checklist/historial",
                )
            )

    # --------------------------------------------------------
    # 4. INCIDENTES
    # --------------------------------------------------------
    incidentes = db.scalars(select(Incidente).options(selectinload(Incidente.equipo))).all()

    for incidente in incidentes:
        if incidente.estado != EstadoIncidente.ABIERTO.value:
            continue

        if incidente.equipo_id is not None:
            grupo = f"equipo:{incidente.equipo_id}"
        else:
            grupo = f"incidente-tipo:{incidente.tipo}"

        detalle = incidente.descripcion
        if incidente.equipo is not None:
            detalle = f"{incidente.equipo.nombre} · {detalle}"

        alertas.append(
            _crear_alerta(
                clave=f"incidente-{incidente.id}",
                origen="INCIDENTE",
                entidad_id=incidente.id,
                grupo_clave=grupo,
                titulo=incidente.titulo,
                detalle=detalle,
                regla="INCIDENTE_ABIERTO",
                fecha_referencia=incidente.fecha_reporte.date(),
                destino=f"/incidentes/{incidente.id}",
            )
        )

    # --------------------------------------------------------
    # 5. REGLAS DE ELEVACIÓN
    # --------------------------------------------------------
    situaciones_por_grupo = Counter(
        alerta["grupo_clave"] for alerta in alertas
    )

    recurrencia = _recurrencia_incidentes(incidentes, desde)
    recurrencia.update(
        _recurrencia_checklists(db, desde, hoy)
    )

    for alerta in alertas:
        elevaciones: list[str] = []

        # Regla 1: varias situaciones actuales sobre el mismo elemento.
        if situaciones_por_grupo[alerta["grupo_clave"]] >= 2:
            alerta["criticidad"] = _subir(alerta["criticidad"])
            elevaciones.append("varias situaciones sobre el mismo elemento")

        # Regla 2: recurrencia de la situación en los últimos 30 días.
        cantidad = recurrencia.get(alerta["grupo_clave"], 0)
        if cantidad >= UMBRAL_RECURRENCIA:
            alerta["criticidad"] = _subir(alerta["criticidad"])
            elevaciones.append(
                f"recurrencia de {cantidad} ocurrencias en {DIAS_RECURRENCIA} días"
            )

        if elevaciones:
            alerta["motivo"] += "; " + "; ".join(elevaciones)

        alerta["plazo"] = _plazo(alerta["fecha_referencia"], hoy)

    # --------------------------------------------------------
    # 6. PRIORIZACIÓN
    # --------------------------------------------------------
    alertas.sort(
        key=lambda alerta: (
            -ORDEN_CRITICIDAD[alerta["criticidad"]],
            alerta["fecha_referencia"] is None,
            alerta["fecha_referencia"] or date.max,
        )
    )

    altas = sum(1 for a in alertas if a["criticidad"] == "alta")
    medias = sum(1 for a in alertas if a["criticidad"] == "media")
    bajas = sum(1 for a in alertas if a["criticidad"] == "baja")

    # Riesgo general de la entidad.
    # Cada situación conserva su criticidad individual; el nivel de riesgo
    # se obtiene internamente a partir del promedio de esas criticidades.
    valores = {"baja": 1, "media": 2, "alta": 3}
    promedio = (
        sum(valores[a["criticidad"]] for a in alertas) / len(alertas)
        if alertas
        else 1.0
    )

    if promedio >= 2.5:
        nivel_riesgo = "alto"
    elif promedio >= 1.5:
        nivel_riesgo = "medio"
    else:
        nivel_riesgo = "bajo"

    return CriticidadDashboardResponse(
        nivel_riesgo=nivel_riesgo,
        total=len(alertas),
        altas=altas,
        medias=medias,
        bajas=bajas,
        alertas=[
            AlertaCriticidadResponse(
                clave=a["clave"],
                origen=a["origen"],
                entidad_id=a["entidad_id"],
                grupo_clave=a["grupo_clave"],
                icono=a["icono"],
                titulo=a["titulo"],
                detalle=a["detalle"],
                criticidad=a["criticidad"],
                motivo=a["motivo"],
                plazo=a["plazo"],
                fecha_referencia=a["fecha_referencia"],
                destino=a["destino"],
                recambio_id=a["recambio_id"],
            )
            for a in alertas
        ],
    )
