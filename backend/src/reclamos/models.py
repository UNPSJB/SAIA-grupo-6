"""Modelo de los reclamos de clientes sobre una entrega."""

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.models import ModeloBase
from src.establecimientos.models import DatosDeEstablecimiento

if TYPE_CHECKING:  # pragma: no cover - solo para tipado
    from src.clientes.models import Cliente
    from src.incidente.models import Incidente
    from src.lotes.models import LoteProducto
    from src.personal.models import Personal
    from src.salidas.models import Salida


class Reclamo(DatosDeEstablecimiento, ModeloBase):
    """Reclamo de un cliente sobre una entrega (`Salida` en ENTREGADO).

    Los datos del cliente y del lote se heredan de la salida: no se eligen a
    mano. Una misma entrega admite más de un reclamo. Los tres valores del
    plazo (`dias_desde_entrega`, `plazo_referencia_dias` y `fuera_de_plazo`)
    se calculan una sola vez al registrar y quedan persistidos: un cambio
    posterior de la configuración no reescribe el histórico.
    """

    __tablename__ = "reclamos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    salida_id: Mapped[int] = mapped_column(
        ForeignKey("salidas.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    lote_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("clientes.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    # Igual criterio que `Salida.incidente_id`: el vínculo se guarda de los dos
    # lados y una FK declarada formaría un ciclo que SQLite no puede ordenar.
    incidente_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)

    fecha_reclamo: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    motivo: Mapped[str] = mapped_column(String(50), nullable=False)
    detalle: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Copia de la fecha de entrega de la salida al momento del reclamo.
    fecha_entrega_ref: Mapped[date] = mapped_column(Date, nullable=False)
    dias_desde_entrega: Mapped[int] = mapped_column(Integer, nullable=False)
    plazo_referencia_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    fuera_de_plazo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=False
    )
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)

    salida: Mapped["Salida"] = relationship(back_populates="reclamos")
    lote: Mapped["LoteProducto"] = relationship()
    cliente: Mapped["Cliente"] = relationship()
    incidente: Mapped[Optional["Incidente"]] = relationship(
        primaryjoin="Reclamo.incidente_id == Incidente.id",
        foreign_keys="Reclamo.incidente_id",
        viewonly=True,
    )
    registrado_por: Mapped["Personal"] = relationship()
