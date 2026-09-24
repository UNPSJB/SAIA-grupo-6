export type EstadoChecklist = "abierto" | "completo" | "observado" | "cerrado";

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
  checklist_id: number | null;
  fecha: string;
  equipo_id: number;
  estado: EstadoChecklist | null;
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

// Lista plana de tareas del día (todos los equipos), con el nombre del plan
// al que pertenece cada una.
export interface TareaDelDia {
  id: number;
  registro_id: number;
  nombre: string;
  plan_id: number | null;
  plan_nombre: string;
  equipo_id: number;
  equipo_nombre: string;
  completado: boolean;
  fecha_completado?: string | null;
  usuario_id?: number | null;
  // Estado de la cabecera del checklist al que pertenece esta tarea.
  // "cerrado" (o null, cuando aún no existe checklist persistido para una
  // fecha futura) significa que no se puede tocar: es dato histórico.
  checklist_estado?: EstadoChecklist | null;
}

export interface TareasDelDiaResponse {
  fecha: string;
  tareas: TareaDelDia[];
}