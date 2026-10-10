export type TipoTarea =
  | "preoperacional"
  | "operacional"
  | "postoperacional";

export const TIPOS_TAREA: { value: TipoTarea; label: string }[] = [
  { value: "preoperacional", label: "Preoperacional" },
  { value: "operacional", label: "Operacional" },
  { value: "postoperacional", label: "Postoperacional" },
];

export interface Tarea {
  id: number;
  nombre: string;
  frecuencia: number;
  descripcion?: string | null;
  tipo: TipoTarea;
  observaciones?: string | null;
  activo: boolean;
  plan_limpieza_id: number;
}

// Lo mínimo para crear/editar una tarea junto con su plan. La frecuencia
// ahora es propia de cada tarea (antes vivía en el plan).
export interface TareaInput {
  id?: number;
  nombre: string;
  frecuencia: number;
  tipo: TipoTarea;
  descripcion?: string;
  observaciones?: string;
}

export interface PlanLimpieza {
  id: number;
  nombre: string;
  tareas: Tarea[];
  equipo_id: number;
  autor_id: number;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string | null;
}

// Opciones livianas usadas para poblar los <select> del formulario.
// Se piden a los endpoints de las otras entidades (equipos, personal).
// Las tareas ya no entran acá: dejaron de ser un catálogo compartido,
// ahora se cargan y editan siempre como parte de un plan puntual.
export interface EquipoOption {
  id: number;
  nombre: string;
}

export interface PersonalOption {
  id: number;
  nombre: string;
  apellido?: string | null;
}
