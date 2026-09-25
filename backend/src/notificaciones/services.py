from datetime import date, timedelta
from typing import List
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.elementoLimpieza.models import ElementoLimpieza
from src.notificaciones.schemas import NotificacionResponse

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

def obtener_todas_notificaciones(db: Session) -> List[NotificacionResponse]:
    lista_total: List[NotificacionResponse] = []
    lista_total.extend(obtener_notificaciones_elementos_limpieza(db))
    lista_total.sort(key=lambda x: 0 if x.nivel == "VENCIDO" else 1)
    return lista_total