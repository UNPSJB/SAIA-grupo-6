import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { GrafoTrazabilidadResponse } from "../types/grafo";
import type { TrazabilidadLoteInsumo, TrazabilidadLoteProducto } from "../types/trazabilidad";

/** Hacia atrás: del lote de producto hasta el proveedor de cada insumo. */
export async function trazarLoteProducto(id: number): Promise<TrazabilidadLoteProducto> {
  const response = await apiFetch(`${API_URL}/trazabilidad/lotes-producto/${id}`);
  return pedir<TrazabilidadLoteProducto>(response, "Error al obtener la trazabilidad del lote");
}

/** Hacia adelante: de un lote de insumo a los lotes de producto que lo usaron. */
export async function trazarLoteInsumo(id: number): Promise<TrazabilidadLoteInsumo> {
  const response = await apiFetch(`${API_URL}/trazabilidad/lotes-insumo/${id}/lotes-producto`);
  return pedir<TrazabilidadLoteInsumo>(response, "Error al obtener la trazabilidad del lote de insumo");
}

/** Grafo de trazabilidad extremo a extremo (árbol bidireccional). */
export async function obtenerGrafoTrazabilidad(loteId: number): Promise<GrafoTrazabilidadResponse> {
  const response = await apiFetch(`${API_URL}/trazabilidad/lotes-producto/${loteId}/grafo`);
  return pedir<GrafoTrazabilidadResponse>(response, "Error al obtener el grafo de trazabilidad del lote");
}

