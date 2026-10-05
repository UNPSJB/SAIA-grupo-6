import type { Notificacion } from "../types/notificacion";

import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiFetch(`${API_URL}/notificaciones`);
  if (!response.ok) {
    throw new Error("Error al obtener las notificaciones del sistema");
  }
  return response.json();
}