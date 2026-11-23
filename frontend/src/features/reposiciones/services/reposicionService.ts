import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Reposicion } from "../types/reposicion";

/** Lista las reposiciones pendientes o parciales, ordenadas por prioridad y antigüedad. */
export async function obtenerReposicionesPendientes(): Promise<Reposicion[]> {
  const response = await apiFetch(`${API_URL}/reposiciones/pendientes`);
  return pedir<Reposicion[]>(
    response,
    "Error al obtener las reposiciones pendientes"
  );
}
