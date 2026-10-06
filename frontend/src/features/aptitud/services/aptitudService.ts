import type { Aptitud } from "../types/aptitud";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

export async function listarAptitudes(incluirInactivos = false): Promise<Aptitud[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/aptitudes${query}`);

  return pedir<Aptitud[]>(response, "Error al obtener las aptitudes");
}

export async function crearAptitud(
  datos: Omit<Aptitud, "id" | "activo">
): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Aptitud>(response, "Error al crear la aptitud");
}

export async function modificarAptitud(
  id: number,
  datos: Partial<Omit<Aptitud, "id">>
): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Aptitud>(response, "Error al modificar la aptitud");
}

export async function eliminarAptitud(id: number): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`, {
    method: "DELETE",
  });

  return pedir<Aptitud>(response, "Error al eliminar la aptitud");
}

export async function reactivarAptitud(
  id: number,
  datos: Omit<Aptitud, "id" | "activo">
): Promise<Aptitud> {
  return modificarAptitud(id, { ...datos, activo: true });
}

export async function obtenerAptitud(id: number): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`);
  return pedir<Aptitud>(response, "Error al obtener la aptitud");
}