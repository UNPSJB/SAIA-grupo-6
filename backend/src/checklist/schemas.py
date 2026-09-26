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

    # Consumo aproximado del producto químico
    insumo_quimico_id: Optional[int] = None
    cantidad_consumida: Optional[float] = None

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

    # Producto químico utilizado
    insumo_quimico_id: Optional[int] = None

    # Cantidad aproximada consumida
    cantidad_consumida: Optional[float] = Field(
        default=None,
        gt=0
    )


class ChecklistCierre(BaseModel):
    supervisor_id: Optional[int] = None
    observaciones: Optional[str] = None


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