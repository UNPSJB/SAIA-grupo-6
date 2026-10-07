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
                tipo="PLAN_CALIBRACION_MANTENIMIENTO",
                entidad_id=plan.id,
                titulo=f"{tipo_intervencion} {sufijo}",
                mensaje=mensaje,
                nivel=nivel,
                link_destino=(
                    f"/planes-calibracion-mantenimiento/{plan.id}/editar"
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


def obtener_todas_notificaciones(db: Session) -> List[NotificacionResponse]:
    lista_total: List[NotificacionResponse] = []
    lista_total.extend(obtener_notificaciones_elementos_limpieza(db))
    lista_total.extend(obtener_notificaciones_planes_calibracion_mantenimiento(db))
    lista_total.extend(obtener_notificaciones_vencimientos_personal(db))
    lista_total.sort(key=lambda x: 0 if x.nivel == "VENCIDO" else 1)
    return lista_total
