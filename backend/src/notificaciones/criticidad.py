from collections import Counter, defaultdict
from datetime import date, timedelta
from src.common.estado_documento import estado_documento, VENCIDO, PROXIMO
from src.common.fechas import hoy
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.checklist.models import Checklist
from src.documentos.models import Documento
from src.incidente.constants import EstadoIncidente
from src.incidente.models import Incidente
from src.notificaciones import riesgo
from src.notificaciones import services as notificacion_services
from src.notificaciones.impacto import impactos_vigentes
from src.notificaciones.invalidacion import asegurar_notificaciones_al_dia
from src.notificaciones.models import NotificacionPersistida, SituacionRiesgo
from src.reclamos.models import Reclamo
from src.retiros.models import Retiro
from src.salidas.models import Salida
from src.notificaciones.schemas import (
    AlertaCriticidadResponse,
    CriticidadDashboardResponse,
    ResumenElementoResponse,
)


# ============================================================
# MOTOR DE RIESGOS
# ============================================================
#
# Qué hace este módulo (la matemática vive en `riesgo.py`):
#
#   1. Detecta lo presente consultando las fuentes de origen (vencimientos,
#      documentos, checklists, incidentes, stock). Todo se notifica.
#   2. De eso generan riesgo las clases de `riesgo.TIPOS_SITUACION`:
#      incidentes de higiene y contaminación, falla de equipos, plagas y otros;
#      stock por debajo del mínimo; checklists incumplidos; y los
#      vencimientos. Un reclamo, retiro de lote o rechazo de entrega lo genera
#      solo si su causa es higiene o contaminación; una devolución de cliente
#      solo se notifica. Los eventos de riesgo se registran en el historial
#      `situaciones_riesgo`: cuándo apareció cada uno y, si ya terminó, cuándo.
#      Es lo que permite medir persistencia y recurrencia.
#   3. Evalúa cada evento de riesgo (Impacto × Probabilidad) y consolida el
#      riesgo de cada elemento. Lo que no genera riesgo se notifica con
#      puntaje 0.
#
# El motor evalúa; no decide qué hacer. Nada de lo que se haga con una
# situación (un plan, una corrección) toca su impacto ni resta puntos: el riesgo
# baja porque la situación deja de detectarse y porque las detecciones viejas
# salen de la ventana de recurrencia.

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
    return riesgo.etiqueta_de(regla)


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
    """`genera_riesgo` sale de la regla: solo las clases de `riesgo.TIPOS_SITUACION`
    entran en el cálculo. El resto se notifica, sin historial, impacto ni
    probabilidad."""
    return {
        "clave": clave,
        "origen": origen,
        "entidad_id": entidad_id,
        "grupo_clave": grupo_clave,
        "icono": ICONOS[origen],
        "titulo": titulo,
        "detalle": detalle,
        "regla": regla,
        "motivo": _motivo_base(regla),
        "fecha_referencia": fecha_referencia,
        "destino": destino,
        "recambio_id": recambio_id,
        "genera_riesgo": regla in riesgo.TIPOS_SITUACION,
    }


# ============================================================
# HISTORIAL DE SITUACIONES
# ============================================================

def _sembrar_historial(
    db: Session,
    *,
    incidentes: list[Incidente],
    tipos_riesgo: dict[int, str | None],
    checklists: list[Checklist],
    hoy_dia: date,
    desde: date,
) -> None:
    """Reconstruye lo que se pueda del pasado reciente, UNA vez.

    Se ejecuta cuando el historial está vacío (primer arranque con esta versión)
    para que la recurrencia no empiece de cero: se cuentan los incidentes de
    riesgo y los checklists incumplidos de la ventana. Solo se siembra lo ya
    terminado; lo que sigue presente lo crea la detección normal.
    """
    for incidente in incidentes:
        if incidente.estado == EstadoIncidente.ABIERTO.value:
            continue
        tipo = tipos_riesgo.get(incidente.id)
        if tipo is None:
            continue  # no genera riesgo
        reporte = incidente.fecha_reporte.date()
        if reporte < desde:
            continue
        cierre = incidente.fecha_cierre.date() if incidente.fecha_cierre else hoy_dia
        db.add(
            SituacionRiesgo(
                tipo=tipo,
                clave=f"incidente-{incidente.id}",
                elemento=_grupo_incidente(incidente, tipo),
                detectada_en=reporte,
                resuelta_en=max(cierre, reporte),
            )
        )

    dias_incumplidos: set[tuple[int, date]] = set()
    for checklist in checklists:
        if checklist.fecha >= hoy_dia:
            continue  # hoy lo detecta el motor
        if any(not registro.completado for registro in checklist.registros):
            dias_incumplidos.add((checklist.equipo_id, checklist.fecha))

    for equipo_id, fecha in sorted(dias_incumplidos):
        db.add(
            SituacionRiesgo(
                tipo="CHECKLIST_INCOMPLETO",
                clave=_clave_checklist(equipo_id, fecha),
                elemento=f"equipo:{equipo_id}",
                detectada_en=fecha,
                resuelta_en=fecha + timedelta(days=1),
            )
        )


def _grupo_incidente(incidente: Incidente, tipo_riesgo: str | None) -> str:
    """El elemento al que pertenece un incidente: su equipo o, si no tiene, la
    clase de evento (así los de la misma clase sin equipo cuentan juntos)."""
    if incidente.equipo_id is not None:
        return f"equipo:{incidente.equipo_id}"
    return f"incidente-tipo:{(tipo_riesgo or incidente.tipo).lower()}"


def _tipos_de_riesgo(
    db: Session, incidentes: list[Incidente]
) -> dict[int, str | None]:
    """Tipo de evento de riesgo de cada incidente (`None`: no genera riesgo).

    Los reclamos, retiros y rechazos dependen de su causa, que vive en su
    circuito de origen.
    """
    de_sistema = {
        incidente.id: incidente.tipo
        for incidente in incidentes
        if incidente.tipo in riesgo.CAUSAS_DE_CONTAMINACION
    }
    causas: dict[int, str] = {}
    if de_sistema:
        ids = list(de_sistema)
        for modelo, motivo in (
            (Reclamo, Reclamo.motivo),
            (Retiro, Retiro.motivo),
            (Salida, Salida.motivo_rechazo),
        ):
            for incidente_id, causa in db.execute(
                select(modelo.incidente_id, motivo).where(
                    modelo.incidente_id.in_(ids), motivo.is_not(None)
                )
            ):
                causas[incidente_id] = causa

    return {
        incidente.id: riesgo.tipo_situacion_de_incidente(
            incidente.tipo, causas.get(incidente.id)
        )
        for incidente in incidentes
    }


def _clave_checklist(equipo_id: int, fecha: date) -> str:
    return f"checklist-equipo-{equipo_id}-{fecha.isoformat()}"


def _sincronizar_situaciones(
    db: Session,
    alertas: list[dict[str, Any]],
    *,
    hoy_dia: date,
    desde: date,
) -> dict[tuple[str, str], SituacionRiesgo]:
    """Pone el historial al día con lo que el motor detecta ahora.

    - Lo detectado que ya estaba presente sigue siendo la misma situación.
    - Lo detectado que no estaba presente es una situación NUEVA (también si
      es un problema que ya había ocurrido y se había resuelto).
    - Lo que estaba presente y ya no se detecta se marca como resuelto HOY:
      deja de acumular persistencia, sin importar cómo se resolvió.

    No hace commit: lo hace quien recalcula, en la misma transacción.
    Devuelve la situación de cada alerta, por (tipo, clave).
    """
    # Solo importa lo presente y lo resuelto dentro de la ventana: lo anterior
    # ya no puede influir en la recurrencia (se queda en la tabla, pero fuera
    # de esta consulta, para que no crezca con los años).
    relevantes = db.scalars(
        select(SituacionRiesgo)
        .where(
            or_(
                SituacionRiesgo.resuelta_en.is_(None),
                SituacionRiesgo.resuelta_en >= desde,
            )
        )
        .order_by(SituacionRiesgo.id)
    ).all()

    abiertas: dict[tuple[str, str], SituacionRiesgo] = {}
    cerradas_hoy: dict[tuple[str, str], SituacionRiesgo] = {}
    for fila in relevantes:
        clave = (fila.tipo, fila.clave)
        if fila.resuelta_en is None:
            abiertas[clave] = fila
        elif fila.resuelta_en == hoy_dia:
            cerradas_hoy[clave] = fila

    # ¿Ya hubo antes una situación con esta clave (aunque haya salido de la
    # ventana)? Si hubo, lo que vuelve es un problema nuevo y cuenta desde hoy,
    # no desde la fecha de origen (ej.: un incidente reabierto).
    candidatas = {
        a["clave"] for a in alertas
        if (a["regla"], a["clave"]) not in abiertas
        and (a["regla"], a["clave"]) not in cerradas_hoy
    }
    con_historia: set[tuple[str, str]] = set()
    if candidatas:
        con_historia = {
            (tipo, clave)
            for tipo, clave in db.execute(
                select(SituacionRiesgo.tipo, SituacionRiesgo.clave)
                .where(SituacionRiesgo.clave.in_(list(candidatas)))
                .distinct()
            )
        }

    vigentes: dict[tuple[str, str], SituacionRiesgo] = {}
    for alerta in alertas:
        clave = (alerta["regla"], alerta["clave"])
        if clave in vigentes:
            continue

        fila = abiertas.pop(clave, None)
        if fila is not None:
            fila.elemento = alerta["grupo_clave"]
        elif clave in cerradas_hoy:
            # Se resolvió y volvió el mismo día: es una sola situación (el
            # motor trabaja con días enteros).
            fila = cerradas_hoy[clave]
            fila.resuelta_en = None
            fila.elemento = alerta["grupo_clave"]
        else:
            fila = SituacionRiesgo(
                tipo=alerta["regla"],
                clave=alerta["clave"],
                elemento=alerta["grupo_clave"],
                detectada_en=(
                    hoy_dia
                    if clave in con_historia
                    else riesgo.fecha_deteccion_inicial(
                        alerta["regla"], alerta["fecha_referencia"], hoy_dia
                    )
                ),
            )
            db.add(fila)
        vigentes[clave] = fila

    for fila in abiertas.values():  # ya no se detectan
        fila.resuelta_en = hoy_dia

    db.flush()
    return vigentes


# ============================================================
# EVALUACIÓN
# ============================================================

def _numero(valor: float) -> str:
    """Un decimal con coma (es-AR): 4,8."""
    return f"{valor:.1f}".replace(".", ",")


def _motivo(
    regla: str, evaluacion: riesgo.Evaluacion, detecciones: int, dias_presente: int
) -> str:
    return (
        f"{_motivo_base(regla)}; impacto {riesgo.ETIQUETA_IMPACTO[evaluacion.impacto]} "
        f"× probabilidad {_numero(evaluacion.probabilidad)} "
        f"(recurrencia {evaluacion.recurrencia}: {detecciones} en "
        f"{riesgo.DIAS_VENTANA_RECURRENCIA} días; "
        f"persistencia {evaluacion.persistencia}: {dias_presente} "
        f"{'día' if dias_presente == 1 else 'días'}) "
        f"= {_numero(evaluacion.riesgo)}"
    )


def _marcar_sin_riesgo(alerta: dict[str, Any], hoy_dia: date) -> None:
    """Alerta que se notifica pero no genera riesgo: puntaje 0 en todo.

    El nivel histórico queda en "baja" (la columna no admite vacío); lo que la
    distingue es `puntaje == 0`, que las pantallas muestran como "sin riesgo".
    """
    alerta["impacto"] = 0
    alerta["recurrencia"] = 0
    alerta["persistencia"] = 0
    alerta["probabilidad"] = 0.0
    alerta["puntaje"] = 0.0
    alerta["criticidad"] = "baja"
    alerta["detectada_en"] = alerta["fecha_referencia"]
    alerta["motivo"] = f"{_motivo_base(alerta['regla'])}; no se incluye en el cálculo de riesgo"
    alerta["plazo"] = _plazo(alerta["fecha_referencia"], hoy_dia)


def _evaluar_alertas(
    db: Session,
    alertas: list[dict[str, Any]],
    vigentes: dict[tuple[str, str], SituacionRiesgo],
    *,
    hoy_dia: date,
    desde: date,
) -> None:
    """Completa en cada alerta su evaluación de riesgo individual."""
    impactos = impactos_vigentes(db)

    # Detecciones de cada (tipo, elemento) dentro de la ventana: las presentes
    # y las ya resueltas. El historial no se reinicia al resolverse algo.
    detecciones: Counter[tuple[str, str]] = Counter()
    for tipo, elemento in db.execute(
        select(SituacionRiesgo.tipo, SituacionRiesgo.elemento).where(
            SituacionRiesgo.detectada_en >= desde
        )
    ):
        detecciones[(tipo, elemento)] += 1

    for alerta in alertas:
        situacion = vigentes[(alerta["regla"], alerta["clave"])]
        cantidad = detecciones[(alerta["regla"], situacion.elemento)]
        if situacion.detectada_en < desde:
            # Empezó antes de la ventana: no figura en el conteo, pero la
            # situación actual siempre cuenta.
            cantidad += 1
        dias_presente = (hoy_dia - situacion.detectada_en).days

        evaluacion = riesgo.evaluar_situacion(
            impacto=impactos[alerta["regla"]],
            detecciones=cantidad,
            dias_presente=dias_presente,
            tipo=alerta["regla"],
        )

        alerta["impacto"] = evaluacion.impacto
        alerta["recurrencia"] = evaluacion.recurrencia
        alerta["persistencia"] = evaluacion.persistencia
        alerta["probabilidad"] = evaluacion.probabilidad
        alerta["puntaje"] = evaluacion.riesgo
        alerta["criticidad"] = riesgo.criticidad_de(evaluacion.nivel)
        alerta["detectada_en"] = situacion.detectada_en
        alerta["motivo"] = _motivo(alerta["regla"], evaluacion, cantidad, dias_presente)
        alerta["plazo"] = _plazo(alerta["fecha_referencia"], hoy_dia)


# ============================================================
# ARMADO DE LA RESPUESTA
# ============================================================

def _armar_dashboard(
    alertas: list[AlertaCriticidadResponse],
) -> CriticidadDashboardResponse:
    """Ordena las situaciones y consolida el riesgo de cada elemento.

    Lo usan el cálculo en vivo y la lectura de la tabla persistida, para que
    ambos devuelvan exactamente lo mismo.
    """
    alertas = sorted(
        alertas,
        key=lambda a: (
            -a.puntaje,
            a.fecha_referencia is None,
            a.fecha_referencia or date.max,
        ),
    )

    por_elemento: dict[str, list[AlertaCriticidadResponse]] = defaultdict(list)
    for alerta in alertas:
        if alerta.puntaje <= 0:
            continue  # se notifica, pero no entra en el riesgo de ningún elemento
        por_elemento[alerta.grupo_clave or alerta.clave].append(alerta)

    elementos: list[ResumenElementoResponse] = []
    for elemento, situaciones in por_elemento.items():
        puntaje = riesgo.riesgo_consolidado([s.puntaje for s in situaciones])
        for situacion in situaciones:
            situacion.puntaje_elemento = puntaje
        elementos.append(
            ResumenElementoResponse(
                elemento=elemento,
                # `alertas` ya viene de mayor a menor riesgo: la primera es la
                # más grave del elemento.
                etiqueta=situaciones[0].detalle,
                situaciones=len(situaciones),
                puntaje=puntaje,
                nivel=riesgo.nivel_de(puntaje),
            )
        )
    elementos.sort(key=lambda e: -e.puntaje)

    # No hay un riesgo "del establecimiento" en la propuesta: el nivel general
    # que se muestra es el del elemento en peor situación.
    puntaje_maximo = elementos[0].puntaje if elementos else 0.0

    return CriticidadDashboardResponse(
        nivel_riesgo=riesgo.nivel_de(puntaje_maximo),
        puntaje_maximo=puntaje_maximo,
        total=len(alertas),
        altas=sum(1 for a in alertas if a.puntaje > 0 and a.criticidad == "alta"),
        medias=sum(1 for a in alertas if a.puntaje > 0 and a.criticidad == "media"),
        bajas=sum(1 for a in alertas if a.puntaje > 0 and a.criticidad == "baja"),
        alertas=alertas,
        elementos=elementos,
    )


def _reconstruir_desde_persistida(
    filas: list[NotificacionPersistida],
) -> CriticidadDashboardResponse:
    """Reconstruye el CriticidadDashboardResponse desde la tabla persistida."""
    return _armar_dashboard(
        [
            AlertaCriticidadResponse(
                clave=f.id_notificacion,
                origen=f.tipo,
                entidad_id=f.entidad_id,
                grupo_clave=f.grupo_clave or "",
                icono=ICONOS.get(f.tipo, "documento"),
                titulo=f.titulo,
                detalle=f.mensaje,
                criticidad=f.criticidad,
                motivo=f.motivo,
                plazo=f.plazo or "",
                fecha_referencia=f.fecha_referencia,
                destino=f.link_destino,
                recambio_id=f.recambio_id,
                impacto=f.impacto,
                recurrencia=f.recurrencia,
                persistencia=f.persistencia,
                probabilidad=f.probabilidad,
                puntaje=f.puntaje,
                detectada_en=f.detectada_en,
            )
            for f in filas
        ]
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

    No lee ni escribe la tabla persistida de notificaciones: lo usa el recálculo
    (`invalidacion._sincronizar_tabla`) para saber qué filas deben existir.

    SÍ actualiza el historial de situaciones (`situaciones_riesgo`), sin hacer
    commit: el recálculo lo confirma junto con el resto, en una sola
    transacción.
    """
    hoy_dia = hoy()
    desde = hoy_dia - timedelta(days=riesgo.DIAS_VENTANA_RECURRENCIA)

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
    # hoy. Una sola situación por equipo con tareas pendientes hoy (no una por
    # tarea): varias tareas sin completar en la mañana no deben inflar el
    # riesgo del equipo. Cada día distinto con tareas incumplidas es una
    # situación distinta en el historial (clave con la fecha), y eso es lo que
    # cuenta para la recurrencia.
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
                clave=_clave_checklist(equipo_id, hoy_dia),
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
    # Qué incidentes generan riesgo y de qué clase (los reclamos, retiros y
    # rechazos, según su causa).
    tipos_riesgo = _tipos_de_riesgo(db, incidentes)

    for incidente in incidentes:
        if incidente.estado != EstadoIncidente.ABIERTO.value:
            continue

        tipo_riesgo = tipos_riesgo[incidente.id]
        grupo = _grupo_incidente(incidente, tipo_riesgo)

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
                # La clase de riesgo si la tiene; si no, el incidente solo se
                # notifica.
                regla=tipo_riesgo or "INCIDENTE_ABIERTO",
                fecha_referencia=incidente.fecha_reporte.date(),
                destino=f"/incidentes/{incidente.id}",
            )
        )

    # --------------------------------------------------------
    # 5. HISTORIAL Y EVALUACIÓN DE RIESGO
    # --------------------------------------------------------
    # (Se mira solo lo de las clases de riesgo vigentes: si el historial viene
    # de una versión anterior, con otras clases, se siembra igual.)
    if not db.scalar(
        select(func.count())
        .select_from(SituacionRiesgo)
        .where(SituacionRiesgo.tipo.in_(list(riesgo.TIPOS_SITUACION)))
    ):
        _sembrar_historial(
            db,
            incidentes=incidentes,
            tipos_riesgo=tipos_riesgo,
            checklists=checklists_historicos,
            hoy_dia=hoy_dia,
            desde=desde,
        )
        db.flush()

    # Solo lo que genera riesgo tiene historial y se evalúa; el resto se
    # notifica sin puntaje.
    con_riesgo = [a for a in alertas if a["genera_riesgo"]]
    vigentes = _sincronizar_situaciones(db, con_riesgo, hoy_dia=hoy_dia, desde=desde)
    _evaluar_alertas(db, con_riesgo, vigentes, hoy_dia=hoy_dia, desde=desde)
    for alerta in alertas:
        if not alerta["genera_riesgo"]:
            _marcar_sin_riesgo(alerta, hoy_dia)

    # --------------------------------------------------------
    # 6. RESPUESTA (priorización y riesgo por elemento)
    # --------------------------------------------------------
    return _armar_dashboard(
        [
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
                impacto=a["impacto"],
                recurrencia=a["recurrencia"],
                persistencia=a["persistencia"],
                probabilidad=a["probabilidad"],
                puntaje=a["puntaje"],
                detectada_en=a["detectada_en"],
            )
            for a in alertas
        ]
    )
