import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { ClaseFuncional, ClaseFuncionalInput, SugerenciaAditivo } from "../types/aditivo";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listarSugerencias(buscar?: string): Promise<SugerenciaAditivo[]> {
  const query = buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : "";
  const response = await apiFetch(`${API_URL}/aditivos/sugerencias${query}`);
  return pedir<SugerenciaAditivo[]>(response, "Error al obtener la lista de referencia de aditivos");
}

export async function listarClases(incluirInactivas = false): Promise<ClaseFuncional[]> {
  const query = incluirInactivas ? "?incluir_inactivas=true" : "";
  const response = await apiFetch(`${API_URL}/aditivos/clases${query}`);
  return pedir<ClaseFuncional[]>(response, "Error al obtener las clases funcionales");
}

export async function crearClase(datos: ClaseFuncionalInput): Promise<ClaseFuncional> {
  const response = await apiFetch(`${API_URL}/aditivos/clases`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<ClaseFuncional>(response, "Error al crear la clase funcional");
}

export async function modificarClase(
  id: number,
  datos: Partial<ClaseFuncionalInput> & { activo?: boolean },
): Promise<ClaseFuncional> {
  const response = await apiFetch(`${API_URL}/aditivos/clases/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<ClaseFuncional>(response, "Error al modificar la clase funcional");
}

export async function darDeBajaClase(id: number): Promise<ClaseFuncional> {
  const response = await apiFetch(`${API_URL}/aditivos/clases/${id}`, { method: "DELETE" });
  return pedir<ClaseFuncional>(response, "Error al dar de baja la clase funcional");
}
