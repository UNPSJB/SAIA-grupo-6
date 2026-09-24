import type {
  RegistroTareaResponse,
  RegistroTareaUpdate,
  TareasDelDiaResponse,
} from "../types/checklist";

const API_URL = "http://localhost:8000";

export async function obtenerTareasDelDia(fecha?: string): Promise<TareasDelDiaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";

  const response = await fetch(`${API_URL}/checklist/tareas-del-dia${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener las tareas del día");
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