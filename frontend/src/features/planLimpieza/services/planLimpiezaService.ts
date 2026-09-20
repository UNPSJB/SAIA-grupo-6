import type {
  PlanLimpieza,
  TareaInput,
  EquipoOption,
  PersonalOption,
} from "../types/planLimpieza";

const API_URL = "http://localhost:8000";

export interface PlanLimpiezaInput {
  nombre: string;
  frecuencia: number;
  tareas: TareaInput[];
  equipo_id: number;
  autor_id: number;
}

export async function listarPlanesLimpieza(): Promise<PlanLimpieza[]> {
  const response = await fetch(`${API_URL}/planes-limpieza`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener los planes de limpieza");
  }

  return response.json();
}

export async function obtenerPlanLimpieza(id: number): Promise<PlanLimpieza> {
  const response = await fetch(`${API_URL}/planes-limpieza/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el plan de limpieza");
  }

  return response.json();
}

export async function crearPlanLimpieza(
  plan: PlanLimpiezaInput
): Promise<PlanLimpieza> {
  const response = await fetch(`${API_URL}/planes-limpieza`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al crear el plan de limpieza");
  }

  return response.json();
}

export async function modificarPlanLimpieza(
  id: number,
  plan: PlanLimpiezaInput
): Promise<PlanLimpieza> {
  const response = await fetch(`${API_URL}/planes-limpieza/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al modificar el plan de limpieza");
  }

  return response.json();
}

export async function eliminarPlanLimpieza(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/planes-limpieza/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar el plan de limpieza");
  }
}

// --- Opciones para los <select> del formulario ---
// Se consultan las entidades relacionadas (equipos, personal) para que el
// usuario elija por nombre en lugar de tipear un ID a mano. Las tareas no
// se listan acá: ya no son un catálogo compartido, se cargan como parte
// del propio plan (ver PlanLimpiezaForm).

export async function listarOpcionesEquipos(): Promise<EquipoOption[]> {
  const response = await fetch(`${API_URL}/equipos`);

  if (!response.ok) {
    throw new Error("Error al obtener los equipos");
  }

  return response.json();
}

export async function listarOpcionesPersonal(): Promise<PersonalOption[]> {
  const response = await fetch(`${API_URL}/personal`);

  if (!response.ok) {
    throw new Error("Error al obtener el personal");
  }

  return response.json();
}
