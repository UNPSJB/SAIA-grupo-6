import type { Notificacion } from "../types/notificacion";

import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiFetch(`${API_URL}/notificaciones`);
  return pedir<Notificacion[]>(response, "Error al obtener las notificaciones del sistema");
}

export async function obtenerConfiguracionAlertas(): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`);
  return pedir<{ dias_alerta_vencimiento_personal: number }>(
    response,
    "Error al obtener la configuración de alertas"
  );
}

export async function actualizarConfiguracionAlertas(dias: number): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dias_alerta_vencimiento_personal: dias }),
  });
  return pedir<{ dias_alerta_vencimiento_personal: number }>(
    response,
    "No se pudo guardar la configuración"
  );
}