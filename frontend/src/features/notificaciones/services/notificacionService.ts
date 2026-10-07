import type { Notificacion } from "../types/notificacion";

import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiFetch(`${API_URL}/notificaciones`);
  if (!response.ok) {
    throw new Error("Error al obtener las notificaciones del sistema");
  }
  return response.json();
}


export async function obtenerConfiguracionAlertas(): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`);
  if (!response.ok) {
    throw new Error("Error al obtener la configuración de alertas");
  }
  return response.json();
}

export async function actualizarConfiguracionAlertas(dias: number): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dias_alerta_vencimiento_personal: dias }),
  });
  if (!response.ok) {
    throw new Error("No se pudo guardar la configuración");
  }
  return response.json();
}