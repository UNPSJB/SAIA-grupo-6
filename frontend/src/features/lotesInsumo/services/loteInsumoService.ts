import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  BajaLoteInsumoInput,
  BajaLoteInsumoRegistro,
  IndicadorBajasResponse,
  IngredienteOpcion,
  LoteInsumoInput,
  StockIngrediente,
  StockLoteInsumo,
} from "../types/loteInsumo";

export async function listarStockInsumos(): Promise<StockIngrediente[]> {
  const response = await apiFetch(`${API_URL}/stock/ingredientes`);
  return pedir<StockIngrediente[]>(response, "Error al obtener el stock de insumos");
}

export async function listarStockLotes(
  ingredienteId?: number,
  incluirInactivos = false,
): Promise<StockLoteInsumo[]> {
  const params = new URLSearchParams();
  if (ingredienteId) params.set("ingrediente_id", String(ingredienteId));
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/stock/lotes-insumo${query}`);
  return pedir<StockLoteInsumo[]>(response, "Error al obtener los lotes de insumo");
}

export async function listarLotesSugeridos(ingredienteId: number): Promise<StockLoteInsumo[]> {
  const response = await apiFetch(
    `${API_URL}/lotes-insumo/sugeridos?ingrediente_id=${ingredienteId}&todos=true`,
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

export async function darDeBajaLoteInsumo(
  id: number,
  datos: BajaLoteInsumoInput,
): Promise<unknown> {
  const response = await apiFetch(`${API_URL}/lotes-insumo/${id}/baja`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<unknown>(response, "Error al registrar la baja del lote de insumo");
}

export async function listarBajasLoteInsumo(
  loteInsumoId: number,
): Promise<BajaLoteInsumoRegistro[]> {
  const response = await apiFetch(`${API_URL}/lotes-insumo/${loteInsumoId}/bajas`);
  return pedir<BajaLoteInsumoRegistro[]>(
    response,
    "Error al obtener el historial de bajas del lote",
  );
}

export async function obtenerIndicadorBajas(
  fechaDesde?: string,
  fechaHasta?: string,
): Promise<IndicadorBajasResponse> {
  const params = new URLSearchParams();
  if (fechaDesde) params.set("fecha_desde", fechaDesde);
  if (fechaHasta) params.set("fecha_hasta", fechaHasta);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/stock/bajas-por-motivo${query}`);
  return pedir<IndicadorBajasResponse>(response, "Error al obtener el indicador de bajas");
}

export async function listarIngredientesActivos(): Promise<IngredienteOpcion[]> {
  const response = await apiFetch(`${API_URL}/ingredientes`);
  return pedir<IngredienteOpcion[]>(response, "Error al obtener los ingredientes");
}
