from collections import Counter, defaultdict
from datetime import date, timedelta
from src.common.estado_documento import estado_documento, VENCIDO, PROXIMO
from src.common.fechas import hoy
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.checklist.models import Checklist
from src.documentos.models import Documento
from src.incidente.constants import EstadoIncidente
from src.incidente.models import Incidente
from src.notificaciones import services as notificacion_services
from src.notificaciones.invalidacion import asegurar_notificaciones_al_dia
from src.notificaciones.models import NotificacionPersistida
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
    "STOCK_BAJO": "media",
}

ORDEN_CRITICIDAD = {"alta": 3, "media": 2, "baja": 1}

DIAS_RECURRENCIA = 30
UMBRAL_RECURRENCIA = 3

ICONOS = {
    "ELEMENTO_LIMPIEZA": "limpieza",
    "PLAN_CALIBRACION": "calibracion",
    "PLAN_MANTENIMIENTO": "calibracion",
    "STOCK_BAJO": "stock",
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

    if tipo == "STOCK_BAJO":
        return "STOCK_BAJO"

    if tipo == "DOCUMENTO":
        return (
            "DOCUMENTO_VENCIDO"
            if nivel == "VENCIDO"
            else "DOCUMENTO_PROXIMO"
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
        "STOCK_BAJO": "Stock por debajo del mínimo",
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


def _reconstruir_desde_persistida(
    filas: list[NotificacionPersistida],
) -> CriticidadDashboardResponse:
    """Reconstruye el CriticidadDashboardResponse desde la tabla persistida."""
    alertas_response: list[AlertaCriticidadResponse] = []
    altas = medias = bajas = 0
    valores = {"baja": 1, "media": 2, "alta": 3}
    suma_criticidad = 0

    for f in filas:
        c = f.criticidad
        suma_criticidad += valores.get(c, 1)
        if c == "alta":
            altas += 1
        elif c == "media":
            medias += 1
        else:
            bajas += 1

        alertas_response.append(
            AlertaCriticidadResponse(
                clave=f.id_notificacion,
                origen=f.tipo,
                entidad_id=f.entidad_id,
                grupo_clave=f.grupo_clave or "",
                icono=ICONOS.get(f.tipo, "documento"),
                titulo=f.titulo,
                detalle=f.mensaje,
                criticidad=c,
                motivo=f.motivo,
                plazo=f.plazo or "",
                fecha_referencia=f.fecha_referencia,
                destino=f.link_destino,
                recambio_id=f.recambio_id,
            )
        )

    total = len(alertas_response)
    promedio = (suma_criticidad / total) if total else 1.0

    if promedio >= 2.5:
        nivel_riesgo = "alto"
    elif promedio >= 1.5:
        nivel_riesgo = "medio"
    else:
        nivel_riesgo = "bajo"

    # Ordenar igual que el motor en vivo: criticidad desc, luego fecha.
    alertas_response.sort(
        key=lambda a: (
            -valores.get(a.criticidad, 1),
            a.fecha_referencia is None,
            a.fecha_referencia or date.max,
        )
    )

    return CriticidadDashboardResponse(
        nivel_riesgo=nivel_riesgo,
        total=total,
        altas=altas,
        medias=medias,
        bajas=bajas,
        alertas=alertas_response,
    )


def obtener_criticidad_dashboard(
    db: Session,
) -> CriticidadDashboardResponse:
    """Lee el dashboard desde la tabla persistida, recalculándola antes solo si
    está sucia (hubo cambios) o es de otro día. La campana y el panel muestran
    el mismo número porque leen de la misma tabla."""
    asegurar_notificaciones_al_dia(db)
    filas = db.scalars(select(NotificacionPersistida)).all()
    return _reconstruir_desde_persistida(filas)


def calcular_criticidad_dashboard(
    db: Session,
) -> CriticidadDashboardResponse:
    """Calcula el dashboard EN VIVO desde las fuentes de origen.

    No lee ni escribe la tabla persistida: lo usa el recálculo
    (`invalidacion._sincronizar_tabla`) para saber qué filas deben existir.
    """
    hoy_dia = hoy()
    desde = hoy_dia - timedelta(days=DIAS_RECURRENCIA)

    alertas: list[dict[str, Any]] = []

    # --------------------------------------------------------
    # 1. VENCIMIENTOS EXISTENTES
    # --------------------------------------------------------
    # Se obtienen las fuentes de origen directamente (sin pasar por
    # `obtener_todas_notificaciones`, que lee de la tabla persistida) para
    # evitar una dependencia circular cuando `recalcular_notificaciones_persistidas`
    # llama a esta función con la tabla aún vacía.
    notificaciones_vivas: list = []
    notificaciones_vivas.extend(notificacion_services.obtener_notificaciones_elementos_limpieza(db))
    notificaciones_vivas.extend(notificacion_services.obtener_notificaciones_planes_calibracion_mantenimiento(db))
    notificaciones_vivas.extend(notificacion_services.obtener_notificaciones_vencimientos_personal(db))
    notificaciones_vivas.extend(notificacion_services.obtener_notificaciones_stock_bajo(db))
    notificaciones_vivas.sort(key=lambda x: 0 if x.nivel == "VENCIDO" else 1)

    for notificacion in notificaciones_vivas:

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

    margen_documentos = notificacion_services.obtener_dias_alerta_vencimiento_personal(db)

    for documento in documentos:
        version = documento.version_vigente
        if version is None or version.fecha_vencimiento is None:
            continue

        # Clasificación única con el margen configurable (no el fijo de 15
        # días). Hoy es vigente ("vence hoy", no alerta); venció ayer o antes
        # es VENCIDO; dentro del margen es PROXIMO.
        estado = estado_documento(
            version.fecha_vencimiento, hoy_dia, margen_documentos,
        )

        if estado == VENCIDO:
            regla = "DOCUMENTO_VENCIDO"
            titulo = "Documento vencido"
        elif estado == PROXIMO:
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
            Checklist.fecha <= hoy_dia,
        )
    ).all()

    # Para el panel actual mostramos únicamente las situaciones vigentes de
    # hoy, mientras que todos los días del período se utilizan para recurrencia.
    # Una sola situación por equipo con tareas pendientes hoy (no una por
    # tarea): varias tareas sin completar en la mañana no deben inflar el
    # nivel de todas las alertas del equipo. Cada día histórico distinto aún
    # cuenta como una ocurrencia para la recurrencia en _recurrencia_checklists.
    # Mapa equipo_id -> nombre (ya cargado con selectinload en la consulta).
    nombres_equipo: dict[int, str] = {}
    for checklist in checklists_historicos:
        if checklist.equipo is not None:
            nombres_equipo[checklist.equipo_id] = checklist.equipo.nombre

    equipos_con_pendientes_hoy: set[int] = set()
    for checklist in checklists_historicos:
        if checklist.fecha != hoy_dia:
            continue

        if any(not registro.completado for registro in checklist.registros):
            equipos_con_pendientes_hoy.add(checklist.equipo_id)

    for equipo_id in sorted(equipos_con_pendientes_hoy):
        detalle = nombres_equipo.get(equipo_id, f"equipo {equipo_id}")

        alertas.append(
            _crear_alerta(
                clave=f"checklist-equipo-{equipo_id}-{hoy_dia.isoformat()}",
                origen="CHECKLIST",
                entidad_id=equipo_id,
                grupo_clave=f"equipo:{equipo_id}",
                titulo="Tarea de checklist incumplida",
                detalle=detalle,
                regla="CHECKLIST_INCOMPLETO",
                fecha_referencia=hoy_dia,
                destino=(
                    f"/checklist/historial?equipo_id={equipo_id}"
                    f"&fecha={hoy_dia.isoformat()}"
                ),
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
        _recurrencia_checklists(db, desde, hoy_dia)
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

        alerta["plazo"] = _plazo(alerta["fecha_referencia"], hoy_dia)

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
