export type EstadoChecklist = "abierto" | "completo" | "observado";

export interface ChecklistTareaItem {
  id: number;
  registro_id: number;
  nombre: string;
  plan_limpieza_id: number;
  completado: boolean;
  fecha_completado?: string | null;
  usuario_id?: number | null;
}

export interface ChecklistPlanItem {
  plan_id: number;
  plan_nombre: string;
  tareas: ChecklistTareaItem[];
}

export interface ChecklistResponse {
  checklist_id: number;
  fecha: string;
  equipo_id: number;
  estado: EstadoChecklist;
  observaciones?: string | null;
  planes: ChecklistPlanItem[];
}

export interface RegistroTareaUpdate {
  completado: boolean;
  usuario_id?: number | null;
}

export interface RegistroTareaResponse {
  id: number;
  checklist_id: number;
  tarea_id: number;
  nombre_tarea_historico: string;
  completado: boolean;
  fecha_completado?: string | null;
  usuario_id?: number | null;
}