from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.incidente.constants import EstadoIncidente
from src.Equipo.models import Equipo
from src.personal.models import Personal
from src.models import ModeloBase


class Incidente(ModeloBase):
    __tablename__ = "incidentes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    titulo: Mapped[str] = mapped_column(String(60), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    equipo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipos.id"), nullable=True)
    foto_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)
    fecha_reporte: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    # Estado del incidente: se abre al reportarse y lo cierra el administrador

    estado: Mapped[str] = mapped_column(
        String(20), default=EstadoIncidente.ABIERTO.value, nullable=False
    )
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    observacion_cierre: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsable_cierre_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )

    # Hay dos FK hacia personal (quién reportó y quién resolvió), así que
    equipo: Mapped[Optional["Equipo"]] = relationship()
    usuario: Mapped["Personal"] = relationship(foreign_keys=[usuario_id])
    responsable_cierre: Mapped[Optional["Personal"]] = relationship(
        foreign_keys=[responsable_cierre_id]
    )


class HistorialIncidente(ModeloBase):
    """Bitácora de cierre/reapertura de un incidente.

    A diferencia del incidente (que solo guarda el estado ACTUAL), acá se
    agrega una fila nueva por cada evento: nunca se actualiza ni se borra.
    """

    __tablename__ = "historial_incidentes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incidente_id: Mapped[int] = mapped_column(
        ForeignKey("incidentes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    estado_anterior: Mapped[str] = mapped_column(String(20), nullable=False)
    estado_nuevo: Mapped[str] = mapped_column(String(20), nullable=False)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("personal.id"), nullable=False
    )
    observacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_evento: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, nullable=False
    )

    incidente: Mapped["Incidente"] = relationship()
    usuario: Mapped["Personal"] = relationship()
