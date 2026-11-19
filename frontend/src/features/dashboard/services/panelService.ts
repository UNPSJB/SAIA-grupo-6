import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { CategoriaPanel, PanelInicio } from "../types/paneles";

export interface FiltrosPanel {
  desde: string;
  hasta: string;
  /** Filtro propio del panel (`producto_id`, `sector_id`, `tipo`). */
  extra?: Record<string, string>;
}

/** Indicadores ya agregados de una categoría: un solo pedido por panel. */
export async function obtenerPanel<T>(categoria: CategoriaPanel, filtros: FiltrosPanel): Promise<T> {
  const params = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  for (const [clave, valor] of Object.entries(filtros.extra ?? {})) {
    if (valor !== "") params.set(clave, valor);
  }
  const response = await apiFetch(`${API_URL}/paneles/${categoria}?${params.toString()}`);
  return pedir<T>(response, "No se pudieron cargar los indicadores");
}

/** Estado de hoy de cada área y lo que requiere atención, para el inicio. */
export async function obtenerInicio(): Promise<PanelInicio> {
  const response = await apiFetch(`${API_URL}/paneles/inicio`);
  return pedir<PanelInicio>(response, "No se pudo cargar el estado de las áreas");
}
