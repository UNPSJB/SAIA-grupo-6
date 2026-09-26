from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from src.checklist.models import EstadoChecklist


class ChecklistTareaItem(BaseModel):
    id: int  # ID de la tarea
    registro_id: int  # ID de registro_tareas
    nombre: str
    plan_limpieza_id: int
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_id: Optional[int] = None
    evidencia_url: Optional[str] = None # AGREGUE ESTO

    model_config = ConfigDict(from_attributes=True)


class ChecklistPlanItem(BaseModel):
    plan_id: int
    plan_nombre: str
    tareas: List[ChecklistTareaItem]

    model_config = ConfigDict(from_attributes=True)


class ChecklistResponse(BaseModel):
    checklist_id: Optional[int] = None
    fecha: date
    equipo_id: int
    estado: Optional[EstadoChecklist] = None
    observaciones: Optional[str] = None
    planes: List[ChecklistPlanItem]

    model_config = ConfigDict(from_attributes=True)


class RegistroTareaUpdate(BaseModel):
    completado: bool
    usuario_id: Optional[int] = None


class ChecklistCierre(BaseModel):
    supervisor_id: Optional[int] = None
    observaciones: Optional[str] = None


class RegistroTareaResponse(BaseModel):
    id: int
    checklist_id: int
    tarea_id: int
    nombre_tarea_historico: str
    completado: bool
    fecha_completado: Optional[datetime] = None
    usuario_id: Optional[int] = None
    evidencia_url: Optional[str] = None # ESTO TMB

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
    checklist_estado: Optional[EstadoChecklist] = None

    model_config = ConfigDict(from_attributes=True)


class TareasDelDiaResponse(BaseModel):
    fecha: date
    tareas: List[TareaDelDiaItem]

class HistorialRegistroTareaItem(BaseModel):
    id: int
    completado: bool
    usuario_id: Optional[int] = None
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