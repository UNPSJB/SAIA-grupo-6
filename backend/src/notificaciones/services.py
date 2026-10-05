from datetime import date, timedelta
from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from src.Equipo.models import Equipo
from src.elementoLimpieza.models import ElementoLimpieza
from src.notificaciones.schemas import NotificacionResponse
from src.PlanCalibracionMantenimiento.models import PlanCalibracionMantenimiento

MARGEN_DIAS_ALERTA = 3

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


def obtener_todas_notificaciones(db: Session) -> List[NotificacionResponse]:
    lista_total: List[NotificacionResponse] = []
    lista_total.extend(obtener_notificaciones_elementos_limpieza(db))
    lista_total.extend(obtener_notificaciones_planes_calibracion_mantenimiento(db))
    lista_total.sort(key=lambda x: 0 if x.nivel == "VENCIDO" else 1)
    return lista_total
