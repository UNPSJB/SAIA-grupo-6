"""Modelos del plan de acción.

El plan TRATA una causa identificada sobre un conjunto de situaciones del
motor de riesgos (`situaciones_riesgo`). No escribe el impacto ni el riesgo: al
verificar una situación, es el motor quien la evalúa con probabilidad mínima.
Conserva todo el historial: alcance, acciones, evidencias, cambios de estado,
y el riesgo de los elementos alcanzados antes, durante y después.
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.common.fechas import ahora
from src.establecimientos.models import DatosDeEstablecimiento, columna_sede_pk
from src.models import ModeloBase
from src.notificaciones.models import SituacionRiesgo
from src.personal.models import Personal
from src.planes_accion.constants import EstadoPlan, EstadoSituacionPlan


class PlanAccion(DatosDeEstablecimiento, ModeloBase):
    __tablename__ = "planes_accion"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    #: Tipo de situación que se busca corregir (clave de `riesgo.TIPOS_SITUACION`).
    tipo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default=EstadoPlan.BORRADOR.value, index=True
    )

    #: Situación desde la que se creó el plan.
    situacion_origen_id: Mapped[int] = mapped_column(
        ForeignKey("situaciones_riesgo.id"), nullable=False
    )
    causa: Mapped[str] = mapped_column(Text, nullable=False)
    objetivo: Mapped[str] = mapped_column(Text, nullable=False)
    #: Cómo se va a saber que el tratamiento funcionó.
    criterio_eficacia: Mapped[str] = mapped_column(Text, nullable=False)

    responsable_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)
    creado_por_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)

    #: Plan cerrado del que este es continuación (para tratar lo que no funcionó).
    plan_anterior_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="SET NULL"), nullable=True, index=True
    )

    #: Plazo del plan: pasado sin haber llegado a Implementado, queda marcado
    #: como vencido (no es un estado).
    plazo: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    #: Duración del período de observación, tomada de la configuración del tipo
    #: al crear el plan. No cambia aunque después cambie la configuración.
    dias_observacion: Mapped[int] = mapped_column(Integer, nullable=False)

    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    fecha_implementado: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_inicio_observacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin_observacion: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_cierre: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    motivo_cancelacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    #: Mayor id de `situaciones_riesgo` al empezar la observación. Lo que el
    #: motor registre después, en un elemento del alcance, es una detección
    #: nueva durante el período de observación.
    situacion_id_base: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    responsable: Mapped["Personal"] = relationship(foreign_keys=[responsable_id])
    creado_por: Mapped["Personal"] = relationship(foreign_keys=[creado_por_id])
    situacion_origen: Mapped["SituacionRiesgo"] = relationship(foreign_keys=[situacion_origen_id])

    acciones: Mapped[list["AccionPlan"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="AccionPlan.id"
    )
    situaciones: Mapped[list["SituacionPlan"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="SituacionPlan.id"
    )
    evidencias: Mapped[list["EvidenciaPlan"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="EvidenciaPlan.id"
    )
    historial: Mapped[list["HistorialPlan"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="HistorialPlan.id"
    )
    riesgos: Mapped[list["RiesgoElementoPlan"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="RiesgoElementoPlan.id"
    )


class AccionPlan(DatosDeEstablecimiento, ModeloBase):
    """Una medida del plan, con su responsable y su plazo."""

    __tablename__ = "acciones_plan"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    responsable_id: Mapped[int] = mapped_column(ForeignKey("personal.id"), nullable=False)
    plazo: Mapped[date] = mapped_column(Date, nullable=False)

    #: Se completa con su evidencia de implementación.
    completada_en: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    completada_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("personal.id"), nullable=True
    )

    plan: Mapped["PlanAccion"] = relationship(back_populates="acciones")
    responsable: Mapped["Personal"] = relationship(foreign_keys=[responsable_id])


class SituacionPlan(DatosDeEstablecimiento, ModeloBase):
    """Una situación del alcance del plan, con su propio estado de tratamiento."""

    __tablename__ = "situaciones_plan"
    __table_args__ = (UniqueConstraint("plan_id", "situacion_id", name="uq_situacion_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    situacion_id: Mapped[int] = mapped_column(
        ForeignKey("situaciones_riesgo.id"), nullable=False, index=True
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default=EstadoSituacionPlan.PENDIENTE.value
    )
    es_origen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    agregada_en: Mapped[date] = mapped_column(Date, nullable=False)
    verificada_en: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Último riesgo que el motor le midió a la situación mientras estaba
    # presente (se actualiza al leer los planes). Cuando el plan la corrige, la
    # situación deja de detectarse y su notificación se borra: esto es lo único
    # que queda para mostrar cuánto riesgo sacó el plan.
    ultimo_impacto: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ultima_probabilidad: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ultimo_puntaje: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    plan: Mapped["PlanAccion"] = relationship(back_populates="situaciones")
    situacion: Mapped["SituacionRiesgo"] = relationship()


class EvidenciaPlan(DatosDeEstablecimiento, ModeloBase):
    """Evidencia de implementación (por acción) o de verificación (por situación)."""

    __tablename__ = "evidencias_plan"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    accion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("acciones_plan.id", ondelete="CASCADE"), nullable=True, index=True
    )
    situacion_plan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("situaciones_plan.id", ondelete="CASCADE"), nullable=True, index=True
    )
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    #: Ruta relativa servida por `/uploads` (exige sesión).
    archivo_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    nombre_archivo: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("personal.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)

    plan: Mapped["PlanAccion"] = relationship(back_populates="evidencias")
    usuario: Mapped[Optional["Personal"]] = relationship(foreign_keys=[usuario_id])


class HistorialPlan(DatosDeEstablecimiento, ModeloBase):
    """Bitácora del plan: una fila por cada hecho relevante. Solo se agrega."""

    __tablename__ = "historial_planes_accion"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fecha: Mapped[datetime] = mapped_column(DateTime, default=ahora, nullable=False)
    #: NULL = lo hizo el sistema (el motor, el fin del período de observación).
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("personal.id"), nullable=True)
    evento: Mapped[str] = mapped_column(String(20), nullable=False)
    estado_anterior: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    estado_nuevo: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    detalle: Mapped[str] = mapped_column(Text, nullable=False)

    plan: Mapped["PlanAccion"] = relationship(back_populates="historial")
    usuario: Mapped[Optional["Personal"]] = relationship(foreign_keys=[usuario_id])


class RiesgoElementoPlan(DatosDeEstablecimiento, ModeloBase):
    """Riesgo consolidado de un elemento del alcance en tres momentos: al crear
    el plan, al implementarlo y al cerrarlo. Es el registro de cómo evolucionó,
    no una causa: el riesgo lo calcula siempre el motor."""

    __tablename__ = "riesgos_elemento_plan"
    __table_args__ = (UniqueConstraint("plan_id", "elemento", "momento", name="uq_riesgo_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plan_id: Mapped[int] = mapped_column(
        ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    elemento: Mapped[str] = mapped_column(String(100), nullable=False)
    #: Texto para mostrar el elemento (el detalle de su situación más grave).
    etiqueta: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    momento: Mapped[str] = mapped_column(String(15), nullable=False)
    #: Riesgo REAL del elemento (lo que calcula el motor, sin planes).
    puntaje: Mapped[float] = mapped_column(Float, nullable=False)
    nivel: Mapped[str] = mapped_column(String(12), nullable=False)
    #: Riesgo TRATADO: el real sin las situaciones que un plan verificado tiene
    #: bajo control. NULL en registros anteriores a esta columna (= al real).
    puntaje_tratado: Mapped[float | None] = mapped_column(Float, nullable=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)

    plan: Mapped["PlanAccion"] = relationship(back_populates="riesgos")


class ConfiguracionObservacion(DatosDeEstablecimiento, ModeloBase):
    """Período de observación (en días) de un tipo de situación, si el
    administrador de este establecimiento lo cambió. Lo que no figura usa el
    valor por defecto."""

    __tablename__ = "configuracion_observacion"

    establecimiento_id: Mapped[int] = columna_sede_pk()
    tipo: Mapped[str] = mapped_column(String(40), primary_key=True)
    dias: Mapped[int] = mapped_column(Integer, nullable=False)
