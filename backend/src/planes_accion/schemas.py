from datetime import date, datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from src.common.paginacion import Pagina

# Texto obligatorio: se recorta y no puede quedar vacío.
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
TextoCorto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]

EstadoPlanLiteral = Literal[
    "borrador",
    "en_ejecucion",
    "implementado",
    "en_verificacion",
    "cerrado_eficaz",
    "cerrado_parcial",
    "cerrado_no_eficaz",
    "cancelado",
]
EstadoSituacionLiteral = Literal[
    "pendiente", "accion_implementada", "corregida", "eficaz", "no_eficaz"
]


# ----------------------------------------------------------------------
# Entradas
# ----------------------------------------------------------------------

class AccionCrear(BaseModel):
    descripcion: TextoCorto
    responsable_id: int
    plazo: date


class AccionActualizar(BaseModel):
    descripcion: Optional[TextoCorto] = None
    responsable_id: Optional[int] = None
    plazo: Optional[date] = None


class PlanCrear(BaseModel):
    #: Situación concreta desde la que se crea el plan; define el tipo.
    situacion_origen_id: int
    causa: Texto
    objetivo: Texto
    criterio_eficacia: Texto
    responsable_id: int
    plazo: Optional[date] = None
    #: Plan cerrado del que este es continuación.
    plan_anterior_id: Optional[int] = None
    #: Otras situaciones (del mismo tipo, o de otro tipo del mismo elemento) que el usuario confirma que comparten
    #: causa. Si hay alguna, `confirma_causa_compatible` tiene que ser true.
    situaciones_adicionales: list[int] = Field(default_factory=list)
    confirma_causa_compatible: bool = False
    acciones: list[AccionCrear] = Field(default_factory=list)


class PlanActualizar(BaseModel):
    causa: Optional[Texto] = None
    objetivo: Optional[Texto] = None
    criterio_eficacia: Optional[Texto] = None
    responsable_id: Optional[int] = None
    plazo: Optional[date] = None
    #: Para quitar el plazo hay que mandarlo explícitamente en true.
    quitar_plazo: bool = False


class CancelarPlan(BaseModel):
    motivo: Texto


class AgregarSituaciones(BaseModel):
    situacion_ids: list[int] = Field(min_length=1)
    confirma_causa_compatible: bool = False


class ObservacionActualizar(BaseModel):
    dias: int


# ----------------------------------------------------------------------
# Salidas
# ----------------------------------------------------------------------

class EvidenciaResponse(BaseModel):
    id: int
    tipo: str
    descripcion: str
    archivo_url: Optional[str] = None
    nombre_archivo: Optional[str] = None
    usuario_nombre: Optional[str] = None
    fecha: datetime


class AccionResponse(BaseModel):
    id: int
    descripcion: str
    responsable_id: int
    responsable_nombre: str
    plazo: date
    completada_en: Optional[date] = None
    completada: bool
    vencida: bool
    evidencias: list[EvidenciaResponse] = Field(default_factory=list)


class SituacionPlanResponse(BaseModel):
    id: int
    situacion_id: int
    estado: EstadoSituacionLiteral
    es_origen: bool
    tipo: str
    elemento: str
    #: Texto de la situación (el de su notificación), o el tipo si ya no figura.
    titulo: str
    detalle: str
    detectada_en: date
    resuelta_en: Optional[date] = None
    #: El motor todavía la detecta.
    sigue_presente: bool
    #: Quien verifica tiene que indicar el resultado y su evidencia.
    verificacion_manual: bool
    #: Un plan puede reunir tipos distintos de un mismo elemento.
    tipo_etiqueta: str = ""
    #: Verificada por el plan: queda bajo control y el riesgo tratado la deja afuera
    #: (el riesgo real no cambia).
    controlada: bool = False
    verificada_en: Optional[date] = None
    destino: Optional[str] = None
    evidencias: list[EvidenciaResponse] = Field(default_factory=list)


class HistorialResponse(BaseModel):
    id: int
    fecha: datetime
    usuario_nombre: Optional[str] = None
    evento: str
    estado_anterior: Optional[str] = None
    estado_nuevo: Optional[str] = None
    detalle: str


class RiesgoElementoResponse(BaseModel):
    elemento: str
    etiqueta: str
    momento: Literal["antes", "implementado", "cierre"]
    #: Riesgo real del motor y riesgo tratado (sin lo que el plan tiene bajo control).
    puntaje: float
    nivel: str
    puntaje_tratado: float
    nivel_tratado: str
    fecha: date


class RiesgoActualElemento(BaseModel):
    """Riesgo de un elemento del alcance ahora: el real y el tratado."""

    elemento: str
    etiqueta: str
    puntaje: float
    nivel: str
    puntaje_tratado: float
    nivel_tratado: str
    en_tratamiento: bool


class ProyeccionElemento(BaseModel):
    """Riesgo real de un elemento hoy y una ESTIMACIÓN de cómo quedaría si el
    plan resulta eficaz (todas sus situaciones corregidas)."""

    elemento: str
    etiqueta: str
    #: Situaciones del plan que hoy generan riesgo en este elemento.
    situaciones: int
    actual_puntaje: float
    actual_nivel: str
    proyectado_puntaje: float
    proyectado_nivel: str


class ProyeccionInput(BaseModel):
    situacion_ids: list[int] = Field(default_factory=list, max_length=200)


class PlanResumen(BaseModel):
    id: int
    tipo: str
    tipo_etiqueta: str
    estado: EstadoPlanLiteral
    objetivo: str
    responsable_id: int
    responsable_nombre: str
    plazo: Optional[date] = None
    vencido: bool
    fecha_creacion: datetime
    fecha_fin_observacion: Optional[date] = None
    fecha_cierre: Optional[date] = None
    acciones_total: int
    acciones_completadas: int
    acciones_vencidas: int
    situaciones_total: int
    plan_anterior_id: Optional[int] = None


class PlanDetalle(PlanResumen):
    causa: str
    criterio_eficacia: str
    dias_observacion: int
    creado_por_nombre: str
    fecha_implementado: Optional[date] = None
    fecha_inicio_observacion: Optional[date] = None
    motivo_cancelacion: Optional[str] = None
    #: Se pueden editar los datos, las acciones y el alcance.
    editable: bool
    cancelable: bool
    #: Cantidad de situaciones nuevas del mismo tipo que el plan podría sumar
    #: (solo en Borrador y En ejecución).
    candidatas_nuevas: int = 0
    acciones: list[AccionResponse] = Field(default_factory=list)
    situaciones: list[SituacionPlanResponse] = Field(default_factory=list)
    historial: list[HistorialResponse] = Field(default_factory=list)
    riesgos: list[RiesgoElementoResponse] = Field(default_factory=list)
    #: Cómo quedaría el riesgo de los elementos si se verifican las situaciones
    #: que todavía no están verificadas (vacío si ya no hay nada por verificar).
    proyeccion: list[ProyeccionElemento] = Field(default_factory=list)
    #: Riesgo de los elementos del alcance ahora (real y tratado).
    riesgo_actual: list[RiesgoActualElemento] = Field(default_factory=list)
    #: Planes posteriores creados a partir de este.
    planes_vinculados: list[int] = Field(default_factory=list)


class PlanPagina(Pagina[PlanResumen]):
    pass


class SituacionDisponible(BaseModel):
    """Situación presente que se puede tratar con un plan (o sumar a uno)."""

    model_config = ConfigDict(from_attributes=True)

    situacion_id: int
    tipo: str
    tipo_etiqueta: str
    elemento: str
    #: Clave de la alerta en el centro de notificaciones (para enlazar).
    clave_alerta: Optional[str] = None
    titulo: str
    detalle: str
    detectada_en: date
    criticidad: Optional[Literal["alta", "media", "baja"]] = None
    puntaje: float = 0.0
    recurrencia: int = 1
    destino: Optional[str] = None
    #: SAIA sugiere un plan: riesgo alto o recurrencia elevada.
    sugerir_plan: bool = False


class SituacionConPlan(BaseModel):
    """Situación que ya está en un plan activo (el centro de notificaciones
    muestra el plan en vez de ofrecer crear otro)."""

    clave_alerta: str
    plan_id: int
    plan_estado: EstadoPlanLiteral


class ObservacionTipo(BaseModel):
    tipo: str
    etiqueta: str
    dias: int
    dias_por_defecto: int
    modificado: bool


class ResponsablePosible(BaseModel):
    """Persona a la que se le puede asignar un plan o una acción."""

    id: int
    nombre: str
