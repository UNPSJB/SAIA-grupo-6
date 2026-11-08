import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Aditivo, AditivoInput, ClaseFuncional, ClaseFuncionalInput } from "../types/aditivo";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listarAditivos(incluirInactivos = false): Promise<Aditivo[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/aditivos${query}`);
  return pedir<Aditivo[]>(response, "Error al obtener los aditivos");
}

export async function crearAditivo(datos: AditivoInput): Promise<Aditivo> {
  const response = await apiFetch(`${API_URL}/aditivos`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<Aditivo>(response, "Error al crear el aditivo");
}

export async function modificarAditivo(
  id: number,
  datos: Partial<AditivoInput> & { activo?: boolean },
): Promise<Aditivo> {
  const response = await apiFetch(`${API_URL}/aditivos/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<Aditivo>(response, "Error al modificar el aditivo");
}

export async function darDeBajaAditivo(id: number): Promise<Aditivo> {
  const response = await apiFetch(`${API_URL}/aditivos/${id}`, { method: "DELETE" });
  return pedir<Aditivo>(response, "Error al dar de baja el aditivo");
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
