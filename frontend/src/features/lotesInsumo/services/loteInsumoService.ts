import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  InsumoOpcion,
  LoteInsumoInput,
  StockInsumo,
  StockLoteInsumo,
} from "../types/loteInsumo";

export async function listarStockInsumos(): Promise<StockInsumo[]> {
  const response = await apiFetch(`${API_URL}/stock/insumos`);
  return pedir<StockInsumo[]>(response, "Error al obtener el stock de insumos");
}

export async function listarStockLotes(
  insumoId?: number,
  incluirInactivos = false,
): Promise<StockLoteInsumo[]> {
  const params = new URLSearchParams();
  if (insumoId) params.set("insumo_id", String(insumoId));
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/stock/lotes-insumo${query}`);
  return pedir<StockLoteInsumo[]>(response, "Error al obtener los lotes de insumo");
}

/**
 * Todos los lotes activos del insumo, ordenados por vencimiento (FEFO). Quien
 * consume sugiere el primero con saldo y sin vencer, pero puede elegir otro.
 */
export async function listarLotesSugeridos(insumoId: number): Promise<StockLoteInsumo[]> {
  const response = await apiFetch(
    `${API_URL}/lotes-insumo/sugeridos?insumo_id=${insumoId}&todos=true`,
  );
  return pedir<StockLoteInsumo[]>(response, "Error al obtener los lotes sugeridos");
}

export async function crearLoteInsumo(datos: LoteInsumoInput): Promise<unknown> {
  const response = await apiFetch(`${API_URL}/lotes-insumo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<unknown>(response, "Error al registrar el lote de insumo");
}

export async function darDeBajaLoteInsumo(id: number, motivo: string): Promise<unknown> {
  const response = await apiFetch(`${API_URL}/lotes-insumo/${id}/baja`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
  });
  return pedir<unknown>(response, "Error al dar de baja el lote de insumo");
}

export async function listarInsumosActivos(): Promise<InsumoOpcion[]> {
  const response = await apiFetch(`${API_URL}/insumos`);
  return pedir<InsumoOpcion[]>(response, "Error al obtener los insumos");
}
