import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type { ConfiguracionAlertas } from "../types/configuracion";

export async function obtenerConfiguracionAlertas(): Promise<ConfiguracionAlertas> {
  const response = await apiFetch(`${API_URL}/configuracion/alertas`);
  return pedir<ConfiguracionAlertas>(
    response,
    "Error al obtener la configuración de alertas"
  );
}

export async function actualizarConfiguracionAlertas(
  dias: number
): Promise<ConfiguracionAlertas> {
  const response = await apiFetch(`${API_URL}/configuracion/alertas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dias_alerta_vencimiento_personal: dias }),
  });
  return pedir<ConfiguracionAlertas>(
    response,
    "No se pudo guardar la configuración"
  );
}
