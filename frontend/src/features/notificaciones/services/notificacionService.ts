import type { Notificacion } from "../types/notificacion";

import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiFetch(`${API_URL}/notificaciones`);
  return pedir<Notificacion[]>(response, "Error al obtener las notificaciones del sistema");
}