from datetime import date
from typing import Dict, Literal, Optional
from pydantic import BaseModel, Field

from src.common.paginacion import Pagina


Criticidad = Literal["alta", "media", "baja"]
MotivoPlan = Literal["tipo", "elemento"]
NivelRiesgo = Literal["alto", "medio", "bajo", "sin_riesgo"]
IconoCriticidad = Literal[
    "limpieza",
    "calibracion",
    "stock",
    "incidente",
    "personal",
    "documento",
    "checklist",
]

class NotificacionResponse(BaseModel):
    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None
    leida: bool = False
    # Solo coordina agrupaciones del motor de criticidad; no es parte del
    # contrato público de notificaciones.
    grupo_clave: Optional[str] = Field(default=None, exclude=True)


class AlertaCriticidadResponse(BaseModel):
    clave: str
    origen: str
    entidad_id: int
    grupo_clave: str
    icono: IconoCriticidad
    titulo: str
    detalle: str
    criticidad: Criticidad
    motivo: str
    plazo: str
    fecha_referencia: Optional[date] = None
    destino: str
    recambio_id: Optional[int] = None
    leida: bool = False

    # Evaluación de riesgo (Impacto × Probabilidad). `criticidad` es el nivel
    # de `puntaje` con su nombre histórico (alta/media/baja).
    impacto: int = 1
    recurrencia: int = 1
    persistencia: int = 1
    probabilidad: float = 1.0
    #: Riesgo individual de la situación, de 1 a 9. 0 = se notifica pero no
    #: entra en el cálculo de riesgo (retiros de lote y reclamos de clientes);
    #: en ese caso impacto, recurrencia, persistencia y probabilidad también son 0.
    puntaje: float = 1.0
    #: Riesgo consolidado del elemento al que pertenece la situación.
    puntaje_elemento: float = 0.0
    #: Desde cuándo está presente.
    detectada_en: Optional[date] = None

    #: Plan de acción que la tiene bajo control (verificado). Todo lo de arriba
    #: es el riesgo REAL del motor y no cambia por el plan; con esta marca, el
    #: riesgo "tratado" la deja afuera (`puntaje_tratado` = 0).
    plan_tratamiento_id: Optional[int] = None
    puntaje_tratado: float = 0.0
    #: Riesgo consolidado tratado del elemento al que pertenece.
    puntaje_elemento_tratado: float = 0.0

    # Plan de acción obligatorio.
    #: Plan ACTIVO (todavía sin verificar) que trata la situación, o que trata
    #: otra de la misma familia en el mismo elemento.
    plan_activo_id: Optional[int] = None
    #: Su tipo exige plan desde la primera detección.
    exige_plan: bool = False
    #: Por qué necesita un plan que todavía no tiene: "tipo" (lo exige su
    #: tipo) o "elemento" (su elemento está en riesgo alto). None: no lo
    #: necesita o ya está cubierta.
    motivo_plan: Optional[MotivoPlan] = None
    requiere_plan: bool = False


class ResumenElementoResponse(BaseModel):
    """Riesgo general de un elemento, a partir de todas sus situaciones presentes."""

    #: Identificador del elemento (`grupo_clave`: "equipo:3", "documento:7"...).
    elemento: str
    #: Texto para mostrar: el detalle de su situación más grave.
    etiqueta: str
    situaciones: int
    #: Riesgo REAL: lo que calcula el motor, sin planes de acción.
    puntaje: float
    nivel: NivelRiesgo
    #: Riesgo TRATADO: el real sin las situaciones que un plan verificado tiene
    #: bajo control. Igual al real si no hay ninguna.
    puntaje_tratado: float = 0.0
    nivel_tratado: NivelRiesgo = "sin_riesgo"
    #: Alguna de sus situaciones está bajo control de un plan de acción.
    en_tratamiento: bool = False
    #: Riesgo de lo que queda sin ningún plan (ni activo ni verificado). Si es
    #: alto, el elemento exige un plan de acción.
    puntaje_sin_plan: float = 0.0
    requiere_plan: bool = False


class CriticidadDashboardResponse(BaseModel):
    #: Nivel del elemento en peor situación ("sin_riesgo" si no hay ninguna).
    nivel_riesgo: NivelRiesgo
    #: Riesgo consolidado más alto entre los elementos (0 si no hay situaciones).
    puntaje_maximo: float = 0.0
    total: int
    altas: int
    medias: int
    bajas: int
    no_leidas: int = 0
    alertas: list[AlertaCriticidadResponse]
    #: Un renglón por elemento, del más al menos riesgoso.
    elementos: list[ResumenElementoResponse] = []

    # Lo mismo, pero tratado: sin lo que un plan de acción verificado tiene
    # bajo control. Lo de arriba es siempre el riesgo real.
    nivel_riesgo_tratado: NivelRiesgo = "sin_riesgo"
    puntaje_maximo_tratado: float = 0.0
    altas_tratadas: int = 0
    medias_tratadas: int = 0
    bajas_tratadas: int = 0

    #: Situaciones que necesitan un plan de acción y todavía no lo tienen.
    planes_requeridos: int = 0
    #: Elementos en riesgo alto sin un plan que alcance para bajarlo.
    elementos_alto_sin_plan: int = 0


class CausaSituacionResponse(BaseModel):
    """Una causa de un incidente de circuito (reclamo, retiro o rechazo)."""

    valor: str
    etiqueta: str
    #: Con esta causa, el incidente genera riesgo.
    cuenta: bool
    sugerida: bool


class ImpactoSituacionResponse(BaseModel):
    """Configuración de un tipo de situación en este establecimiento."""

    tipo: str
    etiqueta: str
    #: 1 bajo · 2 medio · 3 alto. Es el que usa el motor.
    impacto: int
    #: El que sugiere SAIA.
    impacto_sugerido: int
    #: Genera riesgo (si no, solo se notifica).
    activo: bool = True
    activo_sugerido: bool = True
    #: Exige plan de acción desde la primera detección.
    plan_obligatorio: bool = False
    plan_obligatorio_sugerido: bool = False
    #: Solo reclamos, retiros y rechazos: qué causas cuentan.
    causas: list[CausaSituacionResponse] = []
    #: True si el administrador cambió algo respecto de lo sugerido.
    modificado: bool


class ImpactoSituacionUpdate(BaseModel):
    """Cambios parciales: lo que no se manda queda como estaba."""

    impacto: Optional[int] = Field(default=None, ge=1, le=3)
    activo: Optional[bool] = None
    plan_obligatorio: Optional[bool] = None
    causas: Optional[list[str]] = None


class ContadoresNotificaciones(BaseModel):
    """Contadores de los dropdowns de filtro del centro de notificaciones.

    `urgencia` cuenta con el filtro de origen aplicado (e ignorando el de
    urgencia); `origen` al revés. Es exactamente lo que hacía el frontend con
    la lista completa, para que los números de cada opción sigan teniendo
    sentido aunque la tabla ya solo reciba una página.
    """

    urgencia: Dict[str, int]
    origen: Dict[str, int]


class NotificacionPagina(Pagina[NotificacionResponse]):
    """Página de notificaciones + los contadores de los filtros."""

    contadores: ContadoresNotificaciones


class ConfiguracionAlertasResponse(BaseModel):
    dias_alerta_vencimiento_personal: int
    # Plazo de referencia (en días) para marcar un reclamo como fuera de plazo.
    plazo_reclamo_dias: int
    # Meta de cumplimiento de las tareas de limpieza (porcentaje).
    meta_cumplimiento_limpieza: int


class PlazoReclamoResponse(BaseModel):
    """Vista mínima del plazo, para usuarios que no administran la configuración."""

    plazo_reclamo_dias: int


class ConfiguracionAlertasUpdate(BaseModel):
    """Cambios parciales: cada tarjeta de configuración guarda su propio campo.

    Todos son opcionales para que actualizar uno no pise los otros con un valor
    viejo que la pantalla tenía cargado.
    """

    dias_alerta_vencimiento_personal: int | None = Field(default=None, ge=1, le=365)
    plazo_reclamo_dias: int | None = Field(default=None, ge=1, le=365)
    meta_cumplimiento_limpieza: int | None = Field(default=None, ge=1, le=100)


class MarcarNotificacionLeidaRequest(BaseModel):
    leida: bool = True
