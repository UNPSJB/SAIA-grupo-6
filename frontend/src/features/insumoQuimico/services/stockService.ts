import { pedir } from "../../../common/api/errors";
import { API_URL, apiFetch } from "../../../common/api/apiClient";
import type {
  FiltrosMovimientosStock,
  FiltrosLotesStock,
  LotesStockResponse,
  MovimientosStockResponse,
  OperacionAjusteStock,
  StockInsumoQuimico,
} from "../types/stock";

export async function listarStockActual(): Promise<StockInsumoQuimico[]> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/stock`);
  return pedir<StockInsumoQuimico[]>(response, "No se pudo obtener el stock actual");
}

export async function listarMovimientosStock(
  filtros: FiltrosMovimientosStock,
): Promise<MovimientosStockResponse> {
  const parametros = new URLSearchParams();

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "") parametros.set(clave, String(valor));
  }

  const query = parametros.toString();
  const response = await apiFetch(
    `${API_URL}/insumos-quimicos/stock/movimientos${query ? `?${query}` : ""}`,
  );
  return pedir<MovimientosStockResponse>(response, "No se pudieron obtener los movimientos");
}

export async function listarLotesStock(filtros: FiltrosLotesStock): Promise<LotesStockResponse> {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "") parametros.set(clave, String(valor));
  }

  const query = parametros.toString();
  const response = await apiFetch(
    `${API_URL}/insumos-quimicos/stock/lotes${query ? `?${query}` : ""}`,
  );
  return pedir<LotesStockResponse>(response, "No se pudieron obtener los lotes");
}

export async function actualizarStockMinimo(
  id: number,
  stockMinimo: string | null,
): Promise<StockInsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}/stock/minimo`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stock_minimo: stockMinimo }),
  });
  return pedir<StockInsumoQuimico>(response, "No se pudo actualizar el stock mínimo");
}

export async function registrarIngresoStock(
  id: number,
  cantidad: string,
  proveedorId: number,
  numeroLote: string,
): Promise<StockInsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}/stock/ingresos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cantidad,
      proveedor_id: proveedorId,
      numero_lote: numeroLote,
    }),
  });
  return pedir<StockInsumoQuimico>(response, "No se pudo registrar el ingreso");
}

export async function registrarAjusteStock(
  id: number,
  cantidad: string,
  operacion: OperacionAjusteStock,
  motivo: string,
): Promise<StockInsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}/stock/ajustes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cantidad, operacion, motivo }),
  });
  return pedir<StockInsumoQuimico>(response, "No se pudo registrar el ajuste");
}
