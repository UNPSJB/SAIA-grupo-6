from datetime import datetime, date
from typing import Optional, List
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import ModeloBase


class EstadoChecklist(str, Enum):
    ABIERTO = "abierto"
    COMPLETO = "completo"
    OBSERVADO = "observado"
    # Se asigna automáticamente cuando el checklist queda "atrás" en el
    # tiempo (fecha < hoy). A partir de ahí es dato histórico: se sigue
    # pudiendo consultar, pero ni la cabecera ni sus registro_tareas
    # admiten modificaciones (ver services.marcar_tarea).
    CERRADO = "cerrado"


class Checklist(ModeloBase):
    """Cabecera diaria de checklist para un equipo."""

    __tablename__ = "checklists"
    __table_args__ = (
        UniqueConstraint("equipo_id", "fecha", name="uq_checklist_equipo_fecha"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("equipos.id"), nullable=False, index=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    estado: Mapped[EstadoChecklist] = mapped_column(
        SQLEnum(EstadoChecklist), default=EstadoChecklist.ABIERTO, nullable=False
    )
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    supervisor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )

    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_actualizacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.now
    )

    equipo: Mapped["Equipo"] = relationship()
    supervisor: Mapped[Optional["Personal"]] = relationship()
    registros: Mapped[List["RegistroTarea"]] = relationship(
        back_populates="checklist", cascade="all, delete-orphan"
    )


class RegistroTarea(ModeloBase):
    __tablename__ = "registro_tareas"
    __table_args__ = (
        UniqueConstraint("checklist_id", "tarea_id", name="uq_registro_checklist_tarea"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    checklist_id: Mapped[int] = mapped_column(
        ForeignKey("checklists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Cambiar a Optional y ondelete="SET NULL":
    tarea_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tareas.id", ondelete="SET NULL"), nullable=True
    )

    nombre_tarea_historico: Mapped[str] = mapped_column(String(100), nullable=False)
    completado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_completado: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    
    # AGREGO LÍNEA NUEVA:
    evidencia_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    checklist: Mapped["Checklist"] = relationship(back_populates="registros")
    tarea: Mapped[Optional["Tarea"]] = relationship()
    usuario: Mapped[Optional["Personal"]] = relationship()
    historial: Mapped[List["HistorialRegistroTarea"]] = relationship(
        back_populates="registro",
        order_by="HistorialRegistroTarea.fecha_evento",
        cascade="all, delete-orphan",
    )

class HistorialRegistroTarea(ModeloBase):
    """Bitácora de auditoría de un RegistroTarea. A diferencia de
    RegistroTarea (que solo guarda el estado ACTUAL y se sobrescribe en
    cada marcar_tarea), acá se agrega una fila nueva por cada evento:
    nunca se actualiza ni se borra una vez creada. Esto es lo que
    satisface el criterio "una vez marcada, la tarea no puede editarse
    sin dejar rastro del cambio" (Historia #9, fila 9)."""

    __tablename__ = "historial_registro_tareas"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registro_tarea_id: Mapped[int] = mapped_column(
        ForeignKey("registro_tareas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completado: Mapped[bool] = mapped_column(Boolean, nullable=False)
    usuario_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )
    evidencia_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Cuándo ocurrió ESTE evento puntual. No confundir con
    # RegistroTarea.fecha_completado, que representa "cuándo quedó
    # completada la tarea actualmente" y se pisa en cada cambio.
    fecha_evento: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    registro: Mapped["RegistroTarea"] = relationship(back_populates="historial")
    usuario: Mapped[Optional["Personal"]] = relationship()    