import type {
  ChecklistResponse,
  RegistroTareaResponse,
  RegistroTareaUpdate,
} from "../types/checklist";

const API_URL = "http://localhost:8000";

export async function obtenerChecklistHoy(
  equipoId: number,
  fecha?: string
): Promise<ChecklistResponse> {
  const params = new URLSearchParams({ equipo_id: String(equipoId) });
  if (fecha) {
    params.append("fecha", fecha);
  }

  const response = await fetch(`${API_URL}/checklist/hoy?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el checklist");
  }

  return response.json();
}

export async function marcarTarea(
  tareaId: number,
  datos: RegistroTareaUpdate,
  fecha?: string
): Promise<RegistroTareaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";
  const response = await fetch(`${API_URL}/checklist/tarea/${tareaId}${params}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al actualizar la tarea");
  }

  return response.json();
}