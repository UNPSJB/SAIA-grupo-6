import type {
  InsumoQuimico,
  InsumoQuimicoFormValues,
  InsumoQuimicoOpcion,
  TipoQuimico,
} from "../types/insumoQuimico";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";


export type ColumnaOrdenInsumoQuimico = "nombre" | "tipo" | "unidad";
export type OrdenInsumoQuimico =
  | `${ColumnaOrdenInsumoQuimico}_asc`
  | `${ColumnaOrdenInsumoQuimico}_desc`;

export interface FiltrosInsumosQuimicos {
  incluirInactivos?: boolean;
  buscar?: string;
  tipo?: TipoQuimico;
  unidadMedidaId?: number;
  orden?: OrdenInsumoQuimico;
}

export async function listarInsumosQuimicos(
  page: number,
  pageSize: number,
  filtros: FiltrosInsumosQuimicos = {}
): Promise<Pagina<InsumoQuimico>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: filtros.incluirInactivos || undefined,
    buscar: filtros.buscar?.trim() || undefined,
    tipo: filtros.tipo,
    unidad_medida_id: filtros.unidadMedidaId,
    orden: filtros.orden,
  });
  const response = await apiFetch(`${API_URL}/insumos-quimicos${query}`);

  return pedir<Pagina<InsumoQuimico>>(response, "Error al obtener los insumos químicos");
}

export async function listarOpcionesInsumosQuimicos(): Promise<InsumoQuimicoOpcion[]> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/opciones`);

  return pedir<InsumoQuimicoOpcion[]>(response, "Error al obtener los productos de limpieza");
}

export async function crearInsumoQuimico(
  datos: InsumoQuimicoFormValues
): Promise<InsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<InsumoQuimico>(response, "Error al crear el insumo químico");
}

export async function modificarInsumoQuimico(
  id: number,
  datos: Partial<InsumoQuimicoFormValues>
): Promise<InsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<InsumoQuimico>(response, "Error al modificar el insumo químico");
}

export async function eliminarInsumoQuimico(id: number): Promise<InsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}`, {
    method: "DELETE",
  });

  return pedir<InsumoQuimico>(response, "Error al eliminar el insumo químico");
}

export async function reactivarInsumoQuimico(
  id: number,
  datos: InsumoQuimicoFormValues
): Promise<InsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...datos, activo: true }),
  });

  return pedir<InsumoQuimico>(response, "Error al reactivar el insumo químico");
}

export async function obtenerInsumoQuimico(id: number): Promise<InsumoQuimico> {
  const response = await apiFetch(`${API_URL}/insumos-quimicos/${id}`);
  return pedir<InsumoQuimico>(response, "Error al obtener el insumo químico");
}