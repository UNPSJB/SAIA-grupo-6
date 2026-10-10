from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from src.checklist.models import EstadoChecklist


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
    # Consumo aproximado del producto químico
    insumo_quimico_id: Optional[int] = None
    cantidad_consumida: Optional[float] = None
    elemento_limpieza_id: Optional[int] = None

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

    # Consumo registrado para esta tarea
    insumo_quimico_id: Optional[int] = None
    cantidad_consumida: Optional[float] = None
    elemento_limpieza_id: Optional[int] = None
    
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

    # Consumo aproximado registrado
    insumo_quimico_id: Optional[int] = None
    cantidad_consumida: Optional[float] = None
    elemento_limpieza_id: Optional[int] = None

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


class ConsumoInsumoItem(BaseModel):
    """Consumo acumulado de un producto químico en un rango de fechas."""

    insumo_quimico_id: int
    nombre: str
    unidad_simbolo: Optional[str] = None
    cantidad_total: float
    cantidad_registros: int


class ConsumoPorFechaItem(BaseModel):
    fecha: date
    cantidad_total: float


class ConsumoInsumosResponse(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    total_general: float
    insumos: List[ConsumoInsumoItem]
    por_fecha: List[ConsumoPorFechaItem]