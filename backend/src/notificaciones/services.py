from datetime import date, timedelta
from src.establecimientos.contexto import sede_efectiva
from src.common.fechas import ahora, hoy
from src.common.estado_documento import VENCIDO
from typing import List
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload
from src.Equipo.models import Equipo
from src.elementoLimpieza.models import ElementoLimpieza
from src.exceptions import NotFound
from src.insumoQuimico.models import InsumoQuimico, StockInsumoQuimico
from src.notificaciones.schemas import NotificacionResponse
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento

from src.aptitud.models import Aptitud
from src.common.texto import coincide_terminos
from src.notificaciones import criticidad as _criticidad_mod
from src.notificaciones.invalidacion import (
    asegurar_notificaciones_al_dia,
    invalidar_notificaciones,
)
from src.notificaciones.models import ConfiguracionAlerta, NotificacionLeida, NotificacionPersistida
from src.personal.models import Personal
from src.lotesInsumo.models import LoteInsumo
from src.unidadMedida.models import UnidadMedida
from src.vencimientoPersonal.models import VencimientoPersonal

MARGEN_DIAS_ALERTA = 3
CLAVE_DIAS_VENCIMIENTO_PERSONAL = "dias_alerta_vencimiento_personal"
DIAS_VENCIMIENTO_PERSONAL_POR_DEFECTO = 15
# Plazo de referencia para los reclamos de clientes (Historia 20). Es solo una
# referencia para marcar el reclamo como "fuera de plazo": no bloquea el alta.
CLAVE_PLAZO_RECLAMO_DIAS = "plazo_reclamo_dias"
PLAZO_RECLAMO_DIAS_POR_DEFECTO = 30
# Meta de cumplimiento de las tareas de limpieza (porcentaje, 1 a 100). Por
# debajo de la meta, el inicio marca Limpieza como "Para revisar". Por defecto
# es 100%: las BPM y los POES piden registrar todas las tareas programadas.
CLAVE_META_CUMPLIMIENTO_LIMPIEZA = "meta_cumplimiento_limpieza"
META_CUMPLIMIENTO_LIMPIEZA_POR_DEFECTO = 100



def obtener_notificaciones_elementos_limpieza(db: Session) -> List[NotificacionResponse]:
    notificaciones: List[NotificacionResponse] = []
    hoy_dia = hoy()

    elementos = db.scalars(
        select(ElementoLimpieza).where(ElementoLimpieza.activo.is_(True))
    ).all()

    for elem in elementos:
        if not elem.fecha_ultimo_recambio or not elem.frecuencia_recambio_dias:
            continue

        fecha_vencimiento = elem.fecha_ultimo_recambio + timedelta(days=elem.frecuencia_recambio_dias)
        dias_restantes = (fecha_vencimiento - hoy_dia).days

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
                    grupo_clave=f"elemento:{elem.id}",
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
                    grupo_clave=f"elemento:{elem.id}",
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
                grupo_clave=f"equipo:{plan.equipo.id}",
            )
        )

    return notificaciones

def obtener_dias_alerta_vencimiento_personal(db: Session) -> int:
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_DIAS_VENCIMIENTO_PERSONAL})
    return config.valor if config else DIAS_VENCIMIENTO_PERSONAL_POR_DEFECTO


def actualizar_dias_alerta_vencimiento_personal(db: Session, dias: int) -> int:
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_DIAS_VENCIMIENTO_PERSONAL})
    if config:
        config.valor = dias
    else:
        db.add(ConfiguracionAlerta(clave=CLAVE_DIAS_VENCIMIENTO_PERSONAL, valor=dias))
    db.commit()
    return dias


def obtener_plazo_reclamo_dias(db: Session) -> int:
    """Días de referencia para marcar un reclamo como fuera de plazo."""
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_PLAZO_RECLAMO_DIAS})
    return config.valor if config else PLAZO_RECLAMO_DIAS_POR_DEFECTO


def actualizar_plazo_reclamo_dias(db: Session, dias: int) -> int:
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_PLAZO_RECLAMO_DIAS})
    if config:
        config.valor = dias
    else:
        db.add(ConfiguracionAlerta(clave=CLAVE_PLAZO_RECLAMO_DIAS, valor=dias))
    db.commit()
    return dias


def obtener_meta_cumplimiento_limpieza(db: Session) -> int:
    """Porcentaje de tareas de limpieza que se espera completar."""
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_META_CUMPLIMIENTO_LIMPIEZA})
    return config.valor if config else META_CUMPLIMIENTO_LIMPIEZA_POR_DEFECTO


def actualizar_meta_cumplimiento_limpieza(db: Session, porcentaje: int) -> int:
    config = db.get(ConfiguracionAlerta, {"establecimiento_id": sede_efectiva(db), "clave": CLAVE_META_CUMPLIMIENTO_LIMPIEZA})
    if config:
        config.valor = porcentaje
    else:
        db.add(ConfiguracionAlerta(clave=CLAVE_META_CUMPLIMIENTO_LIMPIEZA, valor=porcentaje))
    db.commit()
    return porcentaje


def _nombre_persona(persona: Personal) -> str:
    return f"{persona.nombre} {persona.apellido or ''}".strip()

def obtener_notificaciones_vencimientos_personal(db: Session) -> List[NotificacionResponse]:
    notificaciones: List[NotificacionResponse] = []
    hoy_dia = hoy()
    dias_alerta = obtener_dias_alerta_vencimiento_personal(db)
    limite = hoy_dia + timedelta(days=dias_alerta)

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
        dias_restantes = (venc.fecha_vencimiento - hoy_dia).days

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
                grupo_clave=f"persona:{venc.persona_id}",
            )
        )

    return notificaciones

def obtener_notificaciones_vencimiento_lotes_insumo(
    db: Session,
) -> List[NotificacionResponse]:
    hoy_dia = hoy()
    limite = hoy_dia + timedelta(days=MARGEN_DIAS_ALERTA)

    lotes = db.scalars(
        select(LoteInsumo)
        .options(
            selectinload(LoteInsumo.ingrediente),
            selectinload(LoteInsumo.proveedor),
        )
        .where(
            LoteInsumo.activo.is_(True),
            LoteInsumo.fecha_vencimiento.is_not(None),
            LoteInsumo.fecha_vencimiento <= limite,
        )
        .order_by(LoteInsumo.fecha_vencimiento)
    ).all()

    notificaciones = []

    for lote in lotes:
        dias_restantes = (lote.fecha_vencimiento - hoy_dia).days

        if dias_restantes <= 0:
            titulo = "Lote de insumo vencido"
            nivel = "VENCIDO"
            mensaje = (
                f"El lote '{lote.numero_lote}' de '{lote.ingrediente.nombre}' "
                f"del proveedor '{lote.proveedor.nombre}' venció el "
                f"{lote.fecha_vencimiento:%d/%m/%Y}."
            )
        else:
            titulo = "Lote de insumo próximo a vencer"
            nivel = "PROXIMO_A_VENCER"
            mensaje = (
                f"El lote '{lote.numero_lote}' de '{lote.ingrediente.nombre}' "
                f"del proveedor '{lote.proveedor.nombre}' vence en "
                f"{dias_restantes} día(s), el "
                f"{lote.fecha_vencimiento:%d/%m/%Y}."
            )

        notificaciones.append(
            NotificacionResponse(
                id_notificacion=f"lote-insumo-{lote.id}",
                tipo="VENCIMIENTO_LOTE_INSUMO",
                entidad_id=lote.id,
                titulo=titulo,
                mensaje=mensaje,
                nivel=nivel,
                link_destino="/lotes-insumo",
                fecha_referencia=lote.fecha_vencimiento,
                grupo_clave=f"lote-insumo:{lote.id}",
            )
        )

    return notificaciones

def obtener_notificaciones_homologacion_insumos(db: Session) -> List[NotificacionResponse]:
    """Marcas aprobadas cuya homologación venció o está por vencer.

    La vigencia sale de Parámetros nutricionales (12 meses por defecto) y el
    margen de "próximo" es el mismo de los documentos. Vencida, la marca no
    recibe lotes ni se consume hasta que alguien revise su rótulo y vuelva a aprobarla.
    """
    from src.insumos.homologacion import vigencia_meses, vigente_hasta
    from src.insumos.models import ESTADO_APROBADA, Insumo

    hoy_dia = hoy()
    margen = obtener_dias_alerta_vencimiento_personal(db)
    meses = vigencia_meses(db)
    insumos = db.scalars(
        select(Insumo)
        .options(selectinload(Insumo.ingrediente))
        .where(Insumo.activo.is_(True), Insumo.estado_homologacion == ESTADO_APROBADA)
        .order_by(Insumo.id)
    ).all()

    notificaciones = []
    for insumo in insumos:
        vence = vigente_hasta(insumo, meses)
        if vence is None or vence > hoy_dia + timedelta(days=margen):
            continue
        dias = (vence - hoy_dia).days
        marca = f"'{insumo.nombre}' de '{insumo.ingrediente.nombre}'"
        if dias < 0:
            titulo, nivel = "Homologación de insumo vencida", "VENCIDO"
            mensaje = (
                f"La homologación de la marca {marca} venció el {vence:%d/%m/%Y}: "
                "no se pueden recibir ni consumir sus lotes hasta revisar el rótulo y volver a aprobarla."
            )
        else:
            titulo, nivel = "Homologación de insumo próxima a vencer", "PROXIMO_A_VENCER"
            mensaje = (
                f"La homologación de la marca {marca} vence en {dias} día(s), el {vence:%d/%m/%Y}. "
                "Revisá su rótulo y volvé a aprobarla: vencida, no se pueden recibir ni consumir sus lotes."
            )
        notificaciones.append(
            NotificacionResponse(
                id_notificacion=f"homologacion-insumo-{insumo.id}",
                tipo="HOMOLOGACION_INSUMO",
                entidad_id=insumo.id,
                entidad_nombre=insumo.nombre,
                titulo=titulo,
                mensaje=mensaje,
                nivel=nivel,
                link_destino=f"/insumos/{insumo.id}/homologacion",
                fecha_referencia=vence,
                grupo_clave=f"homologacion-insumo:{insumo.id}",
            )
        )
    return notificaciones


def obtener_notificaciones_stock_bajo(db: Session) -> List[NotificacionResponse]:
    filas = db.execute(
        select(
            InsumoQuimico.id,
            InsumoQuimico.nombre,
            StockInsumoQuimico.cantidad_actual,
            StockInsumoQuimico.stock_minimo,
            UnidadMedida.simbolo,
        )
        .join(
            StockInsumoQuimico,
            StockInsumoQuimico.insumo_quimico_id == InsumoQuimico.id,
        )
        .join(UnidadMedida, UnidadMedida.id == InsumoQuimico.unidad_medida_id)
        .where(
            InsumoQuimico.activo.is_(True),
            StockInsumoQuimico.stock_minimo.is_not(None),
            StockInsumoQuimico.cantidad_actual < StockInsumoQuimico.stock_minimo,
        )
        .order_by(InsumoQuimico.nombre)
    ).all()

    return [
        NotificacionResponse(
            id_notificacion=f"stock-bajo-{fila.id}",
            tipo="STOCK_BAJO",
            entidad_id=fila.id,
            titulo="Stock bajo",
            mensaje=(
                f"El insumo '{fila.nombre}' tiene {fila.cantidad_actual} {fila.simbolo} "
                f"disponibles; el mínimo configurado es {fila.stock_minimo} {fila.simbolo}."
            ),
            nivel="STOCK_BAJO",
            link_destino="/gestion-stock/stock",
        )
        for fila in filas
    ]


def _filtrar_por_texto(
    notificaciones: List[NotificacionResponse], buscar: str | None
) -> List[NotificacionResponse]:
    """Deja las notificaciones que matchean la búsqueda en título o mensaje.

    Usa `coincide_terminos`, la MISMA regla que los demás consolidados: cada
    palabra tiene que aparecer (en el título o en el mensaje), sin importar el
    orden ni las tildes. "personal vencido" encuentra "Vencimiento de Personal
    Vencido".
    """
    return [
        n
        for n in notificaciones
        if coincide_terminos((n.titulo, n.mensaje), buscar)
    ]


_GRAVEDAD_CRITICIDAD = {"baja": 1, "media": 2, "alta": 3}


def _mapa_lecturas_usuario(
    db: Session, usuario_id: int | None = None
) -> dict[str, NotificacionLeida]:
    """Consulta NotificacionLeida para ese usuario_id en la sede efectiva."""
    if usuario_id is None:
        usuario_id = db.info.get("usuario_id")
    if usuario_id is None:
        return {}

    lecturas = db.scalars(
        select(NotificacionLeida).where(
            NotificacionLeida.establecimiento_id == sede_efectiva(db),
            NotificacionLeida.usuario_id == usuario_id,
        )
    ).all()
    return {l.id_notificacion: l for l in lecturas}


def _esta_leida(
    fila: NotificacionPersistida, lectura: NotificacionLeida | None
) -> bool:
    if lectura is None:
        return False

    # Re-activación automática si empeora:
    # 1. Si no estaba vencido al leerse y ahora sí está vencido
    if lectura.nivel_leido != "VENCIDO" and fila.nivel == "VENCIDO":
        return False

    # 2. Si la criticidad actual tiene mayor gravedad que la que se leyó
    gravedad_actual = _GRAVEDAD_CRITICIDAD.get(fila.criticidad.lower(), 1)
    gravedad_leida = _GRAVEDAD_CRITICIDAD.get(lectura.criticidad_leida.lower(), 1)
    if gravedad_actual > gravedad_leida:
        return False

    return True


def _filas_a_respuestas(
    filas, lecturas: dict[str, NotificacionLeida] | None = None
) -> List[NotificacionResponse]:
    """Convierte filas de NotificacionPersistida en NotificacionResponse."""
    lecturas = lecturas or {}
    return [
        NotificacionResponse(
            id_notificacion=f.id_notificacion,
            tipo=f.tipo,
            entidad_id=f.entidad_id,
            titulo=f.titulo,
            mensaje=f.mensaje,
            nivel=f.nivel,
            link_destino=f.link_destino,
            fecha_referencia=f.fecha_referencia,
            grupo_clave=f.grupo_clave,
            leida=_esta_leida(f, lecturas.get(f.id_notificacion)),
        )
        for f in filas
    ]



def calcular_filas_notificaciones(db: Session) -> list[dict]:
    """Calcula las filas que DEBEN existir en la tabla persistida.

    Ejecuta el motor de criticidad completo (incluyendo incidentes abiertos y
    checklists incumplidos) con las reglas de elevación aplicadas. NO lee ni
    escribe la tabla persistida: aplicarla (como diff) es trabajo de
    `invalidacion._sincronizar_tabla`.

    Para las fuentes de notificación originales (elementos, planes,
    vencimientos, stock) se preserva el `id_notificacion` y el `nivel`
    originales (VENCIDO / PROXIMO_A_VENCER / STOCK_BAJO) porque el frontend
    los usa para ordenar y pintar iconos. Para documentos, checklists e
    incidentes (que sólo existen en el motor de criticidad) se usa `clave`
    como `id_notificacion` y `criticidad.upper()` como `nivel`.
    """
    dashboard = _criticidad_mod.calcular_criticidad_dashboard(db)

    # Notificaciones originales (para preservar id_notificacion y nivel).
    # Los documentos no entran acá: el motor los arma con su propia clave
    # (`documento-{id}`, sin el prefijo `notificacion-`), así que nunca hacían
    # match y solo costaban una consulta de más.
    notificaciones_originales: List[NotificacionResponse] = []
    notificaciones_originales.extend(obtener_notificaciones_elementos_limpieza(db))
    notificaciones_originales.extend(obtener_notificaciones_planes_calibracion_mantenimiento(db))
    notificaciones_originales.extend(obtener_notificaciones_vencimientos_personal(db))
    notificaciones_originales.extend(obtener_notificaciones_stock_bajo(db))
    notificaciones_originales.extend(obtener_notificaciones_vencimiento_lotes_insumo(db))
    notificaciones_originales.extend(obtener_notificaciones_homologacion_insumos(db))
    por_id = {n.id_notificacion: n for n in notificaciones_originales}

    def _recortar(texto: str | None, largo: int) -> str | None:
        if texto is not None and len(texto) > largo:
            return texto[: largo - 1] + "…"
        return texto

    filas: list[dict] = []
    for a in dashboard.alertas:
        original: NotificacionResponse | None = None
        if a.clave.startswith("notificacion-"):
            id_orig = a.clave[len("notificacion-") :]
            original = por_id.get(id_orig)

        filas.append(
            {
                "id_notificacion": original.id_notificacion if original else a.clave,
                "tipo": original.tipo if original else a.origen,
                "entidad_id": a.entidad_id,
                "titulo": _recortar(a.titulo, 200),
                "mensaje": _recortar(original.mensaje if original else a.detalle, 500),
                "nivel": original.nivel if original else a.criticidad.upper(),
                "link_destino": _recortar(original.link_destino if original else a.destino, 200),
                "fecha_referencia": a.fecha_referencia,
                "grupo_clave": _recortar(a.grupo_clave, 100),
                "criticidad": a.criticidad,
                "motivo": _recortar(a.motivo, 300),
                "plazo": _recortar(a.plazo, 60),
                "recambio_id": a.recambio_id,
                "impacto": a.impacto,
                "recurrencia": a.recurrencia,
                "persistencia": a.persistencia,
                "probabilidad": a.probabilidad,
                "puntaje": a.puntaje,
                "detectada_en": a.detectada_en,
                "plan_tratamiento_id": a.plan_tratamiento_id,
            }
        )

    return filas


def recalcular_notificaciones_persistidas(db: Session, inmediato: bool = False) -> int:
    """Invalida la tabla persistida de notificaciones.

    Es barato: solo marca la tabla como "sucia". El recálculo real ocurre UNA
    vez, en la primera lectura posterior (`asegurar_notificaciones_al_dia`), de
    modo que una ráfaga de mutaciones (p. ej. marcar 10 tareas de un checklist)
    ya no dispara 10 reconstrucciones completas. También se recalcula una vez
    por día, porque VENCIDO / PRÓXIMO y los plazos dependen de `hoy()`.

    Los puntos de llamada existentes siguen funcionando sin cambios. Con
    `inmediato=True` recalcula en el acto (útil para `POST /recalcular`).

    Devuelve la cantidad de notificaciones que hay ahora en la tabla (con
    `inmediato=False` puede ser el valor previo al recálculo).
    """
    invalidar_notificaciones(db)
    if inmediato:
        asegurar_notificaciones_al_dia(db)
    return db.scalar(select(func.count()).select_from(NotificacionPersistida)) or 0


def obtener_todas_notificaciones(
    db: Session, buscar: str | None = None, usuario_id: int | None = None
) -> List[NotificacionResponse]:
    """Lee las notificaciones de la tabla persistida.

    Antes de leer se asegura de que la tabla esté al día (no sucia y del día
    de hoy). Una tabla vacía es un estado válido ("sin alertas") y ya no
    dispara un recálculo. `buscar` se aplica sobre el resultado ya persistido,
    sin volver a consultar las fuentes de origen.
    """
    asegurar_notificaciones_al_dia(db)
    filas = db.scalars(select(NotificacionPersistida)).all()
    lecturas = _mapa_lecturas_usuario(db, usuario_id)
    return _filtrar_por_texto(_filas_a_respuestas(filas, lecturas), buscar)


def marcar_notificacion_leida(
    db: Session,
    id_notificacion: str,
    leida: bool = True,
    usuario_id: int | None = None,
) -> bool:
    """Marca o desmarca una notificación como leída para el usuario."""
    asegurar_notificaciones_al_dia(db)

    if usuario_id is None:
        usuario_id = db.info.get("usuario_id")
    if usuario_id is None:
        raise NotFound("Usuario no autenticado.")

    sede = sede_efectiva(db)
    fila = db.scalars(
        select(NotificacionPersistida).where(
            NotificacionPersistida.establecimiento_id == sede,
            NotificacionPersistida.id_notificacion == id_notificacion,
        )
    ).first()

    if fila is None:
        raise NotFound("La notificación no existe o ya fue resuelta.")

    lectura = db.get(
        NotificacionLeida,
        {
            "establecimiento_id": sede,
            "usuario_id": usuario_id,
            "id_notificacion": id_notificacion,
        },
    )

    if leida:
        if lectura:
            lectura.nivel_leido = fila.nivel
            lectura.criticidad_leida = fila.criticidad
            lectura.leida_en = ahora()
        else:
            db.add(
                NotificacionLeida(
                    establecimiento_id=sede,
                    usuario_id=usuario_id,
                    id_notificacion=id_notificacion,
                    nivel_leido=fila.nivel,
                    criticidad_leida=fila.criticidad,
                    leida_en=ahora(),
                )
            )
    else:
        if lectura:
            db.delete(lectura)

    db.commit()
    return leida


def marcar_todas_notificaciones_leidas(
    db: Session, usuario_id: int | None = None
) -> int:
    """Marca todas las notificaciones activas de la sede como leídas para el usuario."""
    asegurar_notificaciones_al_dia(db)

    if usuario_id is None:
        usuario_id = db.info.get("usuario_id")
    if usuario_id is None:
        return 0

    sede = sede_efectiva(db)
    filas = db.scalars(
        select(NotificacionPersistida).where(
            NotificacionPersistida.establecimiento_id == sede
        )
    ).all()

    ahora_dt = ahora()
    existentes = _mapa_lecturas_usuario(db, usuario_id)

    total_marcadas = 0
    for f in filas:
        lectura = existentes.get(f.id_notificacion)
        if lectura:
            lectura.nivel_leido = f.nivel
            lectura.criticidad_leida = f.criticidad
            lectura.leida_en = ahora_dt
        else:
            db.add(
                NotificacionLeida(
                    establecimiento_id=sede,
                    usuario_id=usuario_id,
                    id_notificacion=f.id_notificacion,
                    nivel_leido=f.nivel,
                    criticidad_leida=f.criticidad,
                    leida_en=ahora_dt,
                )
            )
        total_marcadas += 1

    db.commit()
    return total_marcadas



# ────────────────────────── Listado paginado ──────────────────────────────
#
# El centro de notificaciones antes traía TODAS las alertas y filtraba,
# ordenaba y contaba en el navegador. Acá vive toda esa lógica: la
# consolidación sigue siendo en Python (mezcla tres tablas y fechas
# calculadas), pero el recorte sale del servidor y el frontend solo recibe
# una página.


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
    "STOCK_BAJO",
    "HOMOLOGACION_INSUMO",
    "DOCUMENTO",
    "CHECKLIST",
    "INCIDENTE",
)


def _ordenar(notificaciones: List[NotificacionResponse], orden: str) -> None:
    """Ordena EN EL LUGAR con el criterio pedido.

    `urgencia` (el default histórico) deja los VENCIDOS arriba sin tocar el
    orden relativo del resto; el resto son ordenamientos por columna. El
    desempate por `id_notificacion` hace que el OFFSET/LIMIT sea estable: sin
    él, dos alertas con la misma fecha podían intercambiarse entre páginas.
    """
    if orden in ("urgencia", "estado_asc"):
        notificaciones.sort(
            key=lambda n: (0 if n.nivel == "VENCIDO" else 1, n.id_notificacion)
        )
    elif orden == "estado_desc":
        notificaciones.sort(
            key=lambda n: (1 if n.nivel == "VENCIDO" else 0, n.id_notificacion)
        )
    elif orden in ("vencimiento_asc", "vencimiento_desc"):
        # Las alertas de stock no tienen vencimiento: quedan al final al ascender.
        epoca_min = date.min
        epoca_max = date.max
        notificaciones.sort(
            key=lambda n: (
                n.fecha_referencia or (epoca_min if orden == "vencimiento_desc" else epoca_max),
                n.id_notificacion,
            ),
            reverse=(orden == "vencimiento_desc"),
        )
    elif orden in ("origen_asc", "origen_desc"):
        notificaciones.sort(
            key=lambda n: (n.tipo, n.id_notificacion),
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
    if urgencia not in ("todas", "vencidas", "proximas", "stock_bajo"):
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
        if valor == "stock_bajo":
            return [n for n in lista if n.nivel == "STOCK_BAJO"]
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
            "stock_bajo": len(por_urgencia(base_urgencia, "stock_bajo")),
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
