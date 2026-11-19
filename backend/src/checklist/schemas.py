from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.checklist.models import EstadoChecklist
from src.common.paginacion import Pagina


class ConsumoTareaItem(BaseModel):
    """Un producto químico usado en una tarea, con su cantidad aproximada."""

    insumo_quimico_id: int
    cantidad: float = Field(gt=0)

    model_config = ConfigDict(from_attributes=True)


class ConsumoTareaDetalle(BaseModel):
    """Consumo de una tarea con el nombre y la unidad del producto (detalle histórico)."""

    insumo_quimico_id: int
    nombre: str
    cantidad: float
    unidad_medida_simbolo: Optional[str] = None


class ChecklistTareaItem(BaseModel):
    id: int
    registro_id: int
    nombre: str
    plan_limpieza_id: int
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_id: Optional[int] = None
    evidencia_url: Optional[str] = None
    descripcion: Optional[str] = None  # procedimiento vigente de la tarea
    tipo: Optional[str] = None  # tipo vigente de la tarea (preoperacional/...)
    observaciones: Optional[str] = None  # observaciones vigentes de la tarea
    # Productos químicos usados (cada uno con su cantidad) y elementos de limpieza
    consumos: List[ConsumoTareaItem] = []
    elementos_limpieza_ids: List[int] = []

    # Asignación de operador y cobertura
    operador_id: Optional[int] = None
    operador_nombre: Optional[str] = None
    reemplazado_por_id: Optional[int] = None
    reemplazado_por_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)



class ChecklistResponse(BaseModel):
    checklist_id: Optional[int] = None
    fecha: date
    equipo_id: int
    plan_id: int
    plan_nombre: str
    estado: Optional[EstadoChecklist] = None
    observaciones: Optional[str] = None
    tareas: List[ChecklistTareaItem]

    model_config = ConfigDict(from_attributes=True)


class RegistroTareaUpdate(BaseModel):
    completado: bool
    usuario_id: Optional[int] = None

    # Producto químico utilizado
    insumo_quimico_id: Optional[int] = None

    # Cantidad aproximada consumida
    cantidad_consumida: Optional[float] = Field(
        default=None,
        gt=0
    )

    # Varios productos con su cantidad y varios elementos por tarea.
    consumos: Optional[List[ConsumoTareaItem]] = None
    elementos_limpieza_ids: Optional[List[int]] = None


class RegistroTareaResponse(BaseModel):
    id: int
    checklist_id: int

    # Es Optional porque una tarea puede eliminarse y el registro
    # histórico debe seguir existiendo.
    tarea_id: Optional[int] = None

    nombre_tarea_historico: str
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_id: Optional[int] = None
    evidencia_url: Optional[str] = None

    # Consumo registrado para esta tarea: productos con su cantidad y elementos
    consumos: List[ConsumoTareaItem] = []
    elementos_limpieza_ids: List[int] = []
    
    model_config = ConfigDict(from_attributes=True)


class TareaDelDiaItem(BaseModel):
    id: int
    registro_id: int
    nombre: str
    plan_id: Optional[int] = None
    plan_nombre: str
    equipo_id: int
    equipo_nombre: str
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_id: Optional[int] = None
    evidencia_url: Optional[str] = None

    # Productos químicos usados (cada uno con su cantidad) y elementos de limpieza
    consumos: List[ConsumoTareaItem] = []
    elementos_limpieza_ids: List[int] = []

    # Asignación de operador y cobertura
    operador_id: Optional[int] = None
    operador_nombre: Optional[str] = None
    reemplazado_por_id: Optional[int] = None
    reemplazado_por_nombre: Optional[str] = None

    checklist_estado: Optional[EstadoChecklist] = None
    descripcion: Optional[str] = None  # procedimiento vigente de la tarea
    tipo: Optional[str] = None  # tipo vigente (preoperacional/operacional/...)
    observaciones: Optional[str] = None  # observaciones vigentes de la tarea

    model_config = ConfigDict(from_attributes=True)


class TareasDelDiaResponse(BaseModel):
    fecha: date
    tareas: List[TareaDelDiaItem]


class HistorialRegistroTareaItem(BaseModel):
    id: int
    completado: bool
    usuario_id: Optional[int] = None
    usuario_nombre: Optional[str] = None
    evidencia_url: Optional[str] = None
    fecha_evento: datetime

    model_config = ConfigDict(from_attributes=True)


class HistorialRegistroTareaResponse(BaseModel):
    registro_id: int
    eventos: List[HistorialRegistroTareaItem]



class TareaIncumplidaItem(BaseModel):
    tarea_id: Optional[int] = None
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class HistorialChecklistItem(BaseModel):
    checklist_id: int
    fecha: date
    equipo_id: int
    equipo_nombre: str
    estado: EstadoChecklist
    total_tareas: int
    tareas_completadas: int
    porcentaje_cumplimiento: float
    tareas_incumplidas: List[TareaIncumplidaItem]

    model_config = ConfigDict(from_attributes=True)


class HistorialChecklistResponse(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    equipo_id: Optional[int] = None
    porcentaje_cumplimiento_general: float
    checklists: List[HistorialChecklistItem]


class HistorialChecklistPagina(Pagina[HistorialChecklistItem]):
    """Versión paginada del historial: además del sobre estándar
    (`items`/`total`/...) trae el cumplimiento general del PERÍODO completo,
    que no depende de la página que se esté mirando."""

    fecha_desde: date
    fecha_hasta: date
    equipo_id: Optional[int] = None
    porcentaje_cumplimiento_general: float


class DetalleChecklistTareaItem(BaseModel):
    """Estado registrado de una tarea dentro de un checklist histórico.

    Los nombres de insumo, unidad y elemento se obtienen de los catálogos
    vigentes: RegistroTarea conserva sus IDs, no una copia de esos nombres.
    """

    registro_id: int
    nombre: str
    descripcion: Optional[str] = None
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_nombre: Optional[str] = None
    evidencia_url: Optional[str] = None
    consumos: List[ConsumoTareaDetalle] = []
    elementos_limpieza_nombres: List[str] = []


class DetalleChecklistResponse(BaseModel):
    checklist_id: int
    fecha: date
    equipo_id: int
    equipo_nombre: str
    estado: EstadoChecklist
    total_tareas: int
    tareas_completadas: int
    porcentaje_cumplimiento: float
    tareas: List[DetalleChecklistTareaItem]


class ConsumoInsumoItem(BaseModel):
    """Consumo acumulado de un producto químico en un rango de fechas."""

    insumo_quimico_id: int
    nombre: str
    unidad_simbolo: Optional[str] = None
    cantidad_total: float
    cantidad_registros: int


class ConsumoPorFechaItem(BaseModel):
    fecha: date
    insumo_quimico_id: int
    nombre: str
    unidad_medida_id: int
    unidad_simbolo: Optional[str] = None
    cantidad_total: float


class ConsumoPorUnidadItem(BaseModel):
    unidad_medida_id: int
    unidad_simbolo: Optional[str] = None
    cantidad_total: float


class ConsumoInsumosResponse(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    insumos: List[ConsumoInsumoItem]
    totales_por_unidad: List[ConsumoPorUnidadItem]
    por_producto_fecha: List[ConsumoPorFechaItem]


class CoberturaTareaResponse(BaseModel):
    """Respuesta al asignar o quitar cobertura de una tarea."""
    registro_id: int
    operador_id: Optional[int] = None
    operador_nombre: Optional[str] = None
    reemplazado_por_id: Optional[int] = None
    reemplazado_por_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
