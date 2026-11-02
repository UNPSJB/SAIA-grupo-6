import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  DashboardLotes,
  FiltrosLotes,
  InsumoLote,
  InsumoLoteInput,
  InsumoResumen,
  Lote,
  LoteCreateValues,
  Producto,
} from "../types/lote";

function queryFiltros(filtros: FiltrosLotes = {}): string {
  const params = new URLSearchParams();

  if (filtros.producto?.trim()) params.set("producto", filtros.producto.trim());
  if (filtros.fechaDesde) params.set("fecha_desde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.set("fecha_hasta", filtros.fechaHasta);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listarLotes(filtros: FiltrosLotes = {}): Promise<Lote[]> {
  const response = await apiFetch(`${API_URL}/lotes${queryFiltros(filtros)}`);

  return pedir<Lote[]>(response, "Error al obtener el historial de lotes");
}

export async function obtenerLote(loteId: number): Promise<Lote> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}`);

  return pedir<Lote>(response, "Error al obtener el lote");
}

export async function listarProductos(): Promise<Producto[]> {
  const response = await apiFetch(`${API_URL}/lotes/productos`);

  return pedir<Producto[]>(response, "Error al obtener los productos");
}

export async function listarInsumosDisponibles(): Promise<InsumoResumen[]> {
  const response = await apiFetch(`${API_URL}/lotes/insumos-disponibles`);

  return pedir<InsumoResumen[]>(
    response,
    "Error al obtener los insumos disponibles"
  );
}

export async function crearLote(datos: LoteCreateValues): Promise<Lote> {
  const response = await apiFetch(`${API_URL}/lotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Lote>(response, "Error al registrar el lote");
}

export async function asociarInsumos(
  loteId: number,
  insumos: InsumoLoteInput[]
): Promise<InsumoLote[]> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}/insumos/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ insumos }),
  });

  return pedir<InsumoLote[]>(response, "Error al asociar los insumos al lote");
}

export async function obtenerDashboardLotes(
  filtros: FiltrosLotes = {}
): Promise<DashboardLotes> {
  const response = await apiFetch(
    `${API_URL}/lotes/dashboard${queryFiltros(filtros)}`
  );

  return pedir<DashboardLotes>(
    response,
    "Error al obtener las estadísticas de producción"
  );
}
