import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type {
  EstadoVencimiento,
  TipoVencimiento,
  VencimientoConsolidado,
} from "../types/vencimiento";

export type ColumnaOrdenVencimiento = "tipo" | "vencimiento" | "estado";

/**
 * Claves de orden del backend. `URGENCIA`/`VIGENTES_PRIMERO` son las dos
 * opciones históricas del selector; la tabla manda `estado_asc` (equivalente
 * a URGENCIA) y las claves de columna al hacer clic en el encabezado.
 */
export type OrdenVencimiento =
  | "URGENCIA"
  | "VIGENTES_PRIMERO"
  | `${ColumnaOrdenVencimiento}_asc`
  | `${ColumnaOrdenVencimiento}_desc`;

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
 * `orden` es la clave que entiende el backend: URGENCIA/VIGENTES_PRIMERO o
 * una columna (tipo, vencimiento, estado) con dirección.
 */
export async function obtenerVencimientosPaginados(
  page: number,
  pageSize: number,
  filtros: {
    tipo?: TipoVencimiento;
    estado?: EstadoVencimiento;
    personaId?: number;
    aptitud?: string;
    buscar?: string;
    orden?: OrdenVencimiento;
  } = {}
): Promise<Pagina<VencimientoConsolidado>> {
  const query = queryPagina(page, pageSize, {
    tipo: filtros.tipo,
    estado: filtros.estado,
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