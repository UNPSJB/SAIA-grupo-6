import { pedir } from "../../../common/api/errors";
import { API_URL, apiFetch } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type {
  FiltrosStockActual,
  FiltrosMovimientosStock,
  FiltrosLotesStock,
  LotesStockResponse,
  MovimientosStockResponse,
  OperacionAjusteStock,
  StockInsumoQuimico,
} from "../types/stock";

export async function listarStockActual(
  page: number,
  pageSize: number,
  filtros: FiltrosStockActual = {},
): Promise<Pagina<StockInsumoQuimico>> {
  const query = queryPagina(page, pageSize, {
    buscar: filtros.buscar?.trim() || undefined,
    stock_bajo: filtros.stockBajo,
    orden: filtros.orden,
  });
  const response = await apiFetch(`${API_URL}/insumos-quimicos/stock${query}`);
  return pedir<Pagina<StockInsumoQuimico>>(response, "No se pudo obtener el stock actual");
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

export async function listarMovimientosStockPaginados(
  page: number,
  pageSize: number,
  filtros: Omit<FiltrosMovimientosStock, "limit" | "offset">,
): Promise<Pagina<MovimientosStockResponse["items"][number]>> {
  const respuesta = await listarMovimientosStock({
    ...filtros,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    items: respuesta.items,
    total: respuesta.total,
    page,
    page_size: pageSize,
    total_paginas: Math.max(1, Math.ceil(respuesta.total / pageSize)),
  };
}

export async function listarLotesStockPaginados(
  page: number,
  pageSize: number,
  filtros: Omit<FiltrosLotesStock, "limit" | "offset">,
): Promise<Pagina<LotesStockResponse["items"][number]>> {
  const respuesta = await listarLotesStock({
    ...filtros,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return {
    items: respuesta.items,
    total: respuesta.total,
    page,
    page_size: pageSize,
    total_paginas: Math.max(1, Math.ceil(respuesta.total / pageSize)),
  };
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
