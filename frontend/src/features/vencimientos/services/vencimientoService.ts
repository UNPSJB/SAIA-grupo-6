import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type { TipoVencimiento, VencimientoConsolidado } from "../types/vencimiento";

export async function obtenerVencimientos(
  tipo?: TipoVencimiento
): Promise<VencimientoConsolidado[]> {
  const query = tipo ? `?tipo=${tipo}` : "";
  const response = await apiFetch(`${API_URL}/vencimientos${query}`);
  return pedir<VencimientoConsolidado[]>(response, "Error al obtener los vencimientos");
}

/** Personas y aptitudes con vencimientos, para los dropdowns de filtro. */
export interface VencimientosOpciones {
  personas: { id: number; nombre: string }[];
  aptitudes: string[];
}

export async function obtenerOpcionesVencimientos(): Promise<VencimientosOpciones> {
  const response = await apiFetch(`${API_URL}/vencimientos/opciones`);
  return pedir<VencimientosOpciones>(
    response,
    "Error al obtener las opciones de filtro"
  );
}

/**
 * Una página del consolidado, con filtros y orden resueltos en el servidor.
 * `orden` es el mismo criterio del selector: URGENCIA (vencidos primero, el
 * default) o VIGENTES_PRIMERO.
 */
export async function obtenerVencimientosPaginados(
  page: number,
  pageSize: number,
  filtros: {
    tipo?: TipoVencimiento;
    personaId?: number;
    aptitud?: string;
    buscar?: string;
    orden?: string;
  } = {}
): Promise<Pagina<VencimientoConsolidado>> {
  const query = queryPagina(page, pageSize, {
    tipo: filtros.tipo,
    persona_id: filtros.personaId,
    aptitud: filtros.aptitud,
    buscar: filtros.buscar?.trim() || undefined,
    orden: filtros.orden && filtros.orden !== "URGENCIA" ? filtros.orden : undefined,
  });
  const response = await apiFetch(`${API_URL}/vencimientos/pagina${query}`);
  return pedir<Pagina<VencimientoConsolidado>>(
    response,
    "Error al obtener los vencimientos"
  );
}