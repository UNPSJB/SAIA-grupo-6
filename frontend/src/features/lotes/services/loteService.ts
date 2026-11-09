import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  Consumo,
  ConsumoInput,
  DashboardLotes,
  FiltrosLotes,
  LoteCreateValues,
  LoteDetalle,
  LoteResumen,
} from "../types/lote";

function queryFiltros(filtros: FiltrosLotes = {}): string {
  const params = new URLSearchParams();

  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.fechaDesde) params.set("fecha_desde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.set("fecha_hasta", filtros.fechaHasta);

  const query = params.toString();
  return query ? `?${query}` : "";
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listarLotes(filtros: FiltrosLotes = {}): Promise<LoteResumen[]> {
  const response = await apiFetch(`${API_URL}/lotes${queryFiltros(filtros)}`);
  return pedir<LoteResumen[]>(response, "Error al obtener los lotes de producción");
}

export async function obtenerLote(loteId: number): Promise<LoteDetalle> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}`);
  return pedir<LoteDetalle>(response, "Error al obtener el lote");
}

export async function crearLote(datos: LoteCreateValues): Promise<LoteDetalle> {
  const response = await apiFetch(`${API_URL}/lotes`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<LoteDetalle>(response, "Error al crear el lote");
}

export async function completarItem(loteId: number, itemId: number): Promise<LoteDetalle> {
  const response = await apiFetch(
    `${API_URL}/lotes/${loteId}/checklist/${itemId}/completar`,
    { method: "POST" },
  );
  return pedir<LoteDetalle>(response, "Error al completar la tarea");
}

/** Devuelve el consumo con sus `advertencias` (por ejemplo, stock insuficiente). */
export async function registrarConsumo(
  loteId: number,
  itemId: number,
  datos: ConsumoInput,
): Promise<Consumo> {
  const response = await apiFetch(
    `${API_URL}/lotes/${loteId}/checklist/${itemId}/consumos`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(datos) },
  );
  return pedir<Consumo>(response, "Error al registrar el consumo");
}

export async function cerrarLote(
  loteId: number,
  cantidadProducida: string,
): Promise<LoteDetalle> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}/cerrar`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ cantidad_producida: cantidadProducida }),
  });
  return pedir<LoteDetalle>(response, "Error al cerrar el lote");
}

export async function cancelarLote(loteId: number, motivo: string): Promise<LoteDetalle> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}/cancelar`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ motivo }),
  });
  return pedir<LoteDetalle>(response, "Error al cancelar el lote");
}

export async function obtenerDashboardLotes(
  filtros: FiltrosLotes = {},
): Promise<DashboardLotes> {
  const response = await apiFetch(`${API_URL}/lotes/dashboard${queryFiltros(filtros)}`);
  const datos = await pedir<
    Omit<DashboardLotes, "total_cantidad_producida" | "por_producto"> & {
      total_cantidad_producida: string | number;
      por_producto: {
        producto: string;
        cantidad_producida: string | number;
        cantidad_lotes: number;
        unidad: string;
      }[];
    }
  >(response, "Error al obtener las estadísticas de producción");

  // El backend manda las cantidades como texto decimal; el gráfico necesita números.
  return {
    ...datos,
    total_cantidad_producida: Number(datos.total_cantidad_producida),
    por_producto: datos.por_producto.map((p) => ({
      ...p,
      cantidad_producida: Number(p.cantidad_producida),
    })),
  };
}
