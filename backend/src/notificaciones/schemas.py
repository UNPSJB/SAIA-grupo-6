from datetime import date
from typing import Dict, Literal, Optional
from pydantic import BaseModel, Field

from src.common.paginacion import Pagina


Criticidad = Literal["alta", "media", "baja"]
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


class ResumenElementoResponse(BaseModel):
    """Riesgo general de un elemento, a partir de todas sus situaciones presentes."""

    #: Identificador del elemento (`grupo_clave`: "equipo:3", "documento:7"...).
    elemento: str
    #: Texto para mostrar: el detalle de su situación más grave.
    etiqueta: str
    situaciones: int
    puntaje: float
    nivel: NivelRiesgo


class CriticidadDashboardResponse(BaseModel):
    #: Nivel del elemento en peor situación ("sin_riesgo" si no hay ninguna).
    nivel_riesgo: NivelRiesgo
    #: Riesgo consolidado más alto entre los elementos (0 si no hay situaciones).
    puntaje_maximo: float = 0.0
    total: int
    altas: int
    medias: int
    bajas: int
    alertas: list[AlertaCriticidadResponse]
    #: Un renglón por elemento, del más al menos riesgoso.
    elementos: list[ResumenElementoResponse] = []


class ImpactoSituacionResponse(BaseModel):
    """Impacto base de un tipo de situación en este establecimiento."""

    tipo: str
    etiqueta: str
    #: 1 bajo · 2 medio · 3 alto. Es el que usa el motor.
    impacto: int
    #: El que sugiere SAIA.
    impacto_sugerido: int
    #: True si el administrador lo cambió respecto del sugerido.
    modificado: bool


class ImpactoSituacionUpdate(BaseModel):
    impacto: int = Field(ge=1, le=3)


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


class NotificacionPersistidaResponse(BaseModel):
    """Notificación leída de la tabla persistida (mismo contrato que NotificacionResponse
    pero sin grupo_clave expuesto, que es solo de uso interno)."""

    id_notificacion: str
    tipo: str
    entidad_id: int
    titulo: str
    mensaje: str
    nivel: str
    link_destino: str
    fecha_referencia: Optional[date] = None
