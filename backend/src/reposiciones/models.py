"""Modelo del dominio de reposiciones.

`Reposicion`: deuda comercial de stock con un cliente, originada por una
reserva cancelada (retiro de lote) o una entrega rechazada.
"""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento
from src.reposiciones.constants import (
    ESTADO_REPOSICION_PENDIENTE,
    PRIORIDAD_NORMAL,
)

if TYPE_CHECKING:  # pragma: no cover - solo para tipado
    from src.clientes.models import Cliente
    from src.incidente.models import Incidente
    from src.productos.models import Producto
    from src.retiros.models import Retiro
    from src.salidas.models import Salida


class Reposicion(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "reposiciones"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("clientes.id"), nullable=False, index=True
    )
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id"), nullable=False, index=True
    )
    # Mismo tipo que `Salida.cantidad` (la reserva): Numeric(14, 3).
    cantidad_original: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    cantidad_pendiente: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    estado: Mapped[str] = mapped_column(
        String(20),
        default=ESTADO_REPOSICION_PENDIENTE,
        server_default=ESTADO_REPOSICION_PENDIENTE,
        nullable=False,
        index=True,
    )
    prioridad: Mapped[str] = mapped_column(
        String(20),
        default=PRIORIDAD_NORMAL,
        server_default=PRIORIDAD_NORMAL,
        nullable=False,
    )
    origen: Mapped[str] = mapped_column(String(30), nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), nullable=False
    )
    motivo_anulacion: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    retiro_origen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("retiros.id"), nullable=True, index=True
    )
    salida_origen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("salidas.id"), nullable=True, index=True
    )
    incidente_origen_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("incidentes.id"), nullable=True, index=True
    )

    cliente: Mapped["Cliente"] = relationship()
    producto: Mapped["Producto"] = relationship()
    retiro_origen: Mapped[Optional["Retiro"]] = relationship()
    salida_origen: Mapped[Optional["Salida"]] = relationship()
    incidente_origen: Mapped[Optional["Incidente"]] = relationship()
