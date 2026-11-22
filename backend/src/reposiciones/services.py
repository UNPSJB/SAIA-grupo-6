from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.common.fechas import ahora, hoy
from src.exceptions import BadRequest, NotFound
from src.lotes.models import LoteProducto
from src.personal.models import Personal
from src.salidas.constants import ESTADO_RESERVADO, TIPO_EVENTO_RESERVA
from src.salidas.models import HitoLote, Salida, calcular_cantidades

from .constants import (
    ESTADO_REPOSICION_CUMPLIDA,
    ESTADO_REPOSICION_PARCIAL,
    ESTADO_REPOSICION_PENDIENTE,
    ORIGEN_REPOSICION_RETIRO,
    PRIORIDAD_NORMAL,
)
from .models import Reposicion
from .schemas import ReposicionCumplirRequest


def crear_reposicion_por_reserva_cancelada(db: Session, reserva, retiro_id: int):
    """Registra la deuda de stock con el cliente de una reserva cancelada por retiro.

    `reserva` es una `Salida` (en este proyecto las reservas son salidas en estado
    RESERVADO). No commitea: el caller controla la transacción.
    """
    nueva_repo = Reposicion(
        cliente_id=reserva.cliente_id,
        producto_id=reserva.lote.producto_id,
        cantidad_original=reserva.cantidad,
        cantidad_pendiente=reserva.cantidad,
        estado=ESTADO_REPOSICION_PENDIENTE,
        prioridad=PRIORIDAD_NORMAL,
        origen=ORIGEN_REPOSICION_RETIRO,
        retiro_origen_id=retiro_id,
    )
    db.add(nueva_repo)
    return nueva_repo


def cumplir_reposicion(
    db: Session,
    reposicion_id: int,
    request: ReposicionCumplirRequest,
    usuario: Optional[Personal] = None,
) -> Reposicion:
    """Cumple total o parcialmente una reposición pendiente creando una reserva (`Salida`)
    sobre un lote sano con saldo disponible.
    """
    stmt = (
        select(Reposicion)
        .options(
            selectinload(Reposicion.cliente),
            selectinload(Reposicion.producto),
        )
        .where(Reposicion.id == reposicion_id)
    )
    reposicion = db.scalar(stmt)
    if reposicion is None:
        raise NotFound("La reposición indicada no existe.")

    if reposicion.estado not in (
        ESTADO_REPOSICION_PENDIENTE,
        ESTADO_REPOSICION_PARCIAL,
    ):
        raise BadRequest(
            f"La reposición #{reposicion.id} no se encuentra pendiente (estado actual: {reposicion.estado})."
        )

    cantidad_a_reponer = Decimal(str(request.cantidad_a_reponer))
    pendiente_actual = Decimal(str(reposicion.cantidad_pendiente))

    if cantidad_a_reponer <= Decimal("0"):
        raise BadRequest("La cantidad a reponer debe ser mayor a cero.")

    if cantidad_a_reponer > pendiente_actual:
        raise BadRequest(
            f"La cantidad a reponer ({cantidad_a_reponer}) supera la cantidad pendiente ({pendiente_actual})."
        )

    lote = db.get(LoteProducto, request.lote_id)
    if lote is None:
        raise NotFound("El lote indicado no existe.")

    if lote.retirado:
        raise BadRequest("No se puede asignar un lote retirado del mercado.")

    if lote.producto_id != reposicion.producto_id:
        raise BadRequest("El lote seleccionado no corresponde al producto adeudado.")

    salidas_lote = list(lote.salidas) if lote.salidas is not None else []
    calculo = calcular_cantidades(lote.cantidad_producida, salidas_lote, lote.retirado)
    saldo_disponible = Decimal(str(calculo["saldo"]))

    if cantidad_a_reponer > saldo_disponible:
        raise BadRequest(
            f"El lote no tiene stock disponible suficiente (disponible: {saldo_disponible}, solicitado: {cantidad_a_reponer})."
        )

    detalle_observacion = f"Reserva generada por Reposición #{reposicion.id}"

    nueva_salida = Salida(
        lote_id=lote.id,
        cliente_id=reposicion.cliente_id,
        cantidad=cantidad_a_reponer,
        fecha_reserva=hoy(),
        estado=ESTADO_RESERVADO,
        observacion_entrega=detalle_observacion,
        creado_por_id=usuario.id if usuario is not None else None,
    )
    db.add(nueva_salida)
    db.flush()

    if usuario is not None:
        hito = HitoLote(
            lote_id=lote.id,
            salida_id=nueva_salida.id,
            fecha_hora=ahora(),
            tipo_evento=TIPO_EVENTO_RESERVA,
            descripcion=detalle_observacion,
            usuario_id=usuario.id,
        )
        db.add(hito)

    nuevo_pendiente = pendiente_actual - cantidad_a_reponer
    reposicion.cantidad_pendiente = nuevo_pendiente
    if nuevo_pendiente <= Decimal("0"):
        reposicion.cantidad_pendiente = Decimal("0")
        reposicion.estado = ESTADO_REPOSICION_CUMPLIDA
    else:
        reposicion.estado = ESTADO_REPOSICION_PARCIAL

    db.add(reposicion)
    db.commit()
    db.refresh(reposicion)
    return reposicion
