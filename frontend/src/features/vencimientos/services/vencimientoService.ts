import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type { TipoVencimiento, VencimientoConsolidado } from "../types/vencimiento";

export async function obtenerVencimientos(
  tipo?: TipoVencimiento
): Promise<VencimientoConsolidado[]> {
  const query = tipo ? `?tipo=${tipo}` : "";
  const response = await apiFetch(`${API_URL}/vencimientos${query}`);
  return pedir<VencimientoConsolidado[]>(response, "Error al obtener los vencimientos");
}