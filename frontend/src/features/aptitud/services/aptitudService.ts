import type { Aptitud } from "../types/aptitud";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";

export async function listarAptitudes(incluirInactivos = false): Promise<Aptitud[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/aptitudes${query}`);

  return pedir<Aptitud[]>(response, "Error al obtener las aptitudes");
}

/**
 * Página de aptitudes para la tabla (paginación server-side). La lista
 * completa (`listarAptitudes`) sigue existiendo para los dropdowns de
 * formularios, que necesitan todas las opciones de una vez.
 */
export async function listarAptitudesPaginadas(
  page: number,
  pageSize: number,
  incluirInactivos = false
): Promise<Pagina<Aptitud>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: incluirInactivos || undefined,
  });
  const response = await apiFetch(`${API_URL}/aptitudes${query}`);

  return pedir<Pagina<Aptitud>>(response, "Error al obtener las aptitudes");
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