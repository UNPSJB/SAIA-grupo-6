"""Modelos del dominio de salidas de producto.

- `Salida`: reserva/despacho/entrega de una cantidad de un lote para un cliente.
- `HitoLote`: hito de la línea de tiempo del lote (cimiento mínimo, inmutable).
- `SalidaCertificacion`: tabla de enlace que guarda las certificaciones del
  transportista que estaban vigentes al momento del despacho.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.lotes.models import LoteProducto
from src.models import ModeloBase
from src.personal.models import Personal


class Salida(ModeloBase):
    """Salida de producto: parte de un lote asignada a un cliente."""

    __tablename__ = "salidas"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_salidas_cantidad_positiva"),
        CheckConstraint(
            "estado IN ('RESERVADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO', 'RECHAZADA')",
            name="ck_salidas_estado_valido",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("clientes.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    # Mismo tipo numérico que la cantidad producida del lote: Numeric(14, 3).
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    fecha_reserva: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(20), default="RESERVADO", server_default="RESERVADO", nullable=False, index=True
    )
    creado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)

    # --- Campos de despacho / entrega (todos nulos salvo cuando corresponden) ---
    # Forma de entrega: CON_TRANSPORTISTA o RETIRA_CLIENTE.
    forma_entrega: Mapped[str | None] = mapped_column(String(30), nullable=True)
    transportista_id: Mapped[int | None] = mapped_column(
        ForeignKey("transportistas.id", ondelete="RESTRICT"), nullable=True
    )
    fecha_despacho: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_entrega: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Momento exacto en que se confirmó cada acción (auditoría).
    despachado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    entregado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    observacion_entrega: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Campos de cancelación.
    motivo_cancelacion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cancelada_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )
    fecha_cancelacion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Quién recibió la entrega (si corresponde).
    recibido_por: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # --- Rechazo de la entrega (Historia A) ---
    motivo_rechazo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    detalle_rechazo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fecha_rechazo: Mapped[date | None] = mapped_column(Date, nullable=True)
    rechazada_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )

    # --- Disposición de la mercadería rechazada (Historia B) ---
    # Nula mientras el rechazo está pendiente. La decisión no se puede
    # modificar y no cambia el estado de la salida (que sigue en RECHAZADA).
    disposicion: Mapped[str | None] = mapped_column(String(20), nullable=True)
    justificacion_disposicion: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    fecha_disposicion: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    decidida_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=True
    )
    # Incidente abierto automáticamente al rechazar.
    incidente_id: Mapped[int | None] = mapped_column(
        ForeignKey("incidentes.id", ondelete="SET NULL"), nullable=True, index=True
    )

    lote: Mapped[LoteProducto] = relationship(back_populates="salidas")
    cliente: Mapped["Cliente"] = relationship()
    creado_por: Mapped[Personal | None] = relationship(
        foreign_keys=[creado_por_id]
    )
    transportista: Mapped["Transportista | None"] = relationship()
    cancelada_por: Mapped[Personal | None] = relationship(
        foreign_keys=[cancelada_por_id]
    )
    rechazada_por: Mapped[Personal | None] = relationship(
        foreign_keys=[rechazada_por_id]
    )
    decidida_por: Mapped[Personal | None] = relationship(
        foreign_keys=[decidida_por_id]
    )
    incidente: Mapped["Incidente | None"] = relationship(
        foreign_keys=[incidente_id]
    )
    # Certificaciones del transportista vigentes al momento del despacho.
    certificaciones: Mapped[list["SalidaCertificacion"]] = relationship(
        back_populates="salida", cascade="all, delete-orphan"
    )
    # Reclamos de cliente sobre esta entrega (Historia 20). Una entrega admite
    # más de uno; el vínculo inverso lo define `Reclamo.salida`.
    reclamos: Mapped[list["Reclamo"]] = relationship(back_populates="salida")


class HitoLote(ModeloBase):
    """Hito de la línea de tiempo del lote. Inmutable: sin PUT ni DELETE."""

    __tablename__ = "historial_lotes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lote_id: Mapped[int] = mapped_column(
        ForeignKey("lotes_producto.id", ondelete="CASCADE"), index=True, nullable=False
    )
    salida_id: Mapped[int | None] = mapped_column(
        ForeignKey("salidas.id", ondelete="SET NULL"), nullable=True
    )
    fecha_hora: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False, index=True)
    tipo_evento: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id", ondelete="RESTRICT"), nullable=False
    )

    lote: Mapped[LoteProducto] = relationship()
    salida: Mapped[Salida | None] = relationship()
    usuario: Mapped[Personal] = relationship()


class SalidaCertificacion(ModeloBase):
    """Tabla de enlace: certificaciones del transportista vigentes al despachar.

    No se duplica el dato de la certificación, solo la referencia, para poder
    auditar qué certificaciones respaldaban al transportista en ese momento.
    """

    __tablename__ = "salida_certificaciones"
    __table_args__ = (
        UniqueConstraint(
            "salida_id",
            "certificacion_id",
            name="uq_salida_certificaciones_salida_certificacion",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    salida_id: Mapped[int] = mapped_column(
        ForeignKey("salidas.id", ondelete="CASCADE"), index=True, nullable=False
    )
    certificacion_id: Mapped[int] = mapped_column(
        ForeignKey("certificaciones_transportista.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )

    salida: Mapped[Salida] = relationship(back_populates="certificaciones")
    certificacion: Mapped["CertificacionTransportista"] = relationship()


# ---------------------------------------------------------------------------
# Cálculo puro de cantidades y estado del lote (reutilizable y testeable)
# ---------------------------------------------------------------------------

_CERO = Decimal("0")


def calcular_cantidades(
    producido: Decimal | None,
    salidas: list[Salida],
    retirado: bool,
) -> dict:
    """Calcula reservado, despachado, entregado, saldo y estado del lote.

    Es una función pura: no toca la base, recibe los datos y devuelve un dict.
    Usa `Decimal` para evitar errores de redondeo al comparar.
    """
    producido_q = producido if producido is not None else _CERO

    reservado = sum(
        (s.cantidad for s in salidas if s.estado == "RESERVADO"), _CERO
    )
    despachado = sum(
        (s.cantidad for s in salidas if s.estado == "DESPACHADO"), _CERO
    )
    entregado = sum(
        (s.cantidad for s in salidas if s.estado == "ENTREGADO"), _CERO
    )
    # Mercadería rechazada por el cliente: queda "en revisión" hasta que un
    # administrador decide su destino. DESECHADA se da de baja; REINGRESADA no
    # resta (vuelve al saldo del lote).
    en_revision = sum(
        (
            s.cantidad
            for s in salidas
            if s.estado == "RECHAZADA" and s.disposicion is None
        ),
        _CERO,
    )
    desechado = sum(
        (
            s.cantidad
            for s in salidas
            if s.estado == "RECHAZADA" and s.disposicion == "DESECHADA"
        ),
        _CERO,
    )
    # Las salidas CANCELADAS no suman en ninguna cantidad.

    saldo = producido_q - (
        reservado + despachado + entregado + en_revision + desechado
    )

    if retirado:
        estado_lote = "Retirado"
    elif saldo == 0:
        estado_lote = "Agotado"
    elif saldo == producido_q:
        estado_lote = "En almacén"
    else:
        estado_lote = "Con salidas parciales"

    return {
        "producido": producido_q,
        "reservado": reservado,
        "despachado": despachado,
        "entregado": entregado,
        "en_revision": en_revision,
        "desechado": desechado,
        "saldo": saldo,
        "estado_lote": estado_lote,
    }


def formatear_cantidad(cantidad: Decimal | None) -> str:
    """Devuelve la cantidad sin ceros a la derecha y con coma decimal argentina.

    Ejemplos: 30.000 -> "30", 12.500 -> "12,5", 3.250 -> "3,25".
    """
    if cantidad is None:
        return "0"
    texto = f"{cantidad:,.3f}".rstrip("0").rstrip(".")
    return texto.replace(",", "_").replace(".", ",").replace("_", ".")
