import type { ChecklistResponse, RegistroTareaResponse } from "../types/checklist";

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

// MODIFICACIÓN: Ya no recibe un objeto JSON, recibe los parámetros sueltos
// para armar el FormData.
export async function marcarTarea(
  tareaId: number,
  completado: boolean,
  usuarioId: number,
  evidencia?: File,
  fecha?: string
): Promise<RegistroTareaResponse> {
  const params = fecha ? `?fecha=${fecha}` : "";
  
  // Armamos el "paquete" de datos que soporta archivos
  const formData = new FormData();
  formData.append("completado", String(completado));
  formData.append("usuario_id", String(usuarioId));
  
  if (evidencia) {
    formData.append("evidencia", evidencia);
  }

  const response = await fetch(`${API_URL}/checklist/tarea/${tareaId}${params}`, {
    method: "PATCH",
    // IMPORTANTE: Al usar FormData, fetch configura automáticamente el Content-Type
    // correcto (multipart/form-data) con su boundary. No lo agregues manual.
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al actualizar la tarea");
  }

  return response.json();
}