import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type { ConfiguracionVistaPublica } from "../types/vistaPublica";

export async function obtenerConfiguracionVistaPublica(): Promise<ConfiguracionVistaPublica> {
  const response = await apiFetch(`${API_URL}/vista-publica/configuracion`);
  return pedir<ConfiguracionVistaPublica>(
    response,
    "No se pudo cargar la configuración de la vista pública.",
  );
}

export async function actualizarConfiguracionVistaPublica(
  habilitada: boolean,
): Promise<ConfiguracionVistaPublica> {
  const response = await apiFetch(`${API_URL}/vista-publica/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ habilitada }),
  });
  return pedir<ConfiguracionVistaPublica>(
    response,
    "No se pudo actualizar la vista pública.",
  );
}
