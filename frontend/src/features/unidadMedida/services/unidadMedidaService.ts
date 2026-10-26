import type { UnidadMedida } from "../types/unidadMedida";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";


export async function listarUnidadesMedida(incluirInactivos = false): Promise<UnidadMedida[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/unidades-medida${query}`);

  return pedir<UnidadMedida[]>(response, "Error al obtener las unidades de medida");
}

/**
 * Página de unidades para la tabla (paginación server-side). La lista
 * completa de arriba sigue existiendo para los dropdowns de los formularios
 * de insumos, que necesitan todas las opciones de una vez.
 */
export async function listarUnidadesMedidaPaginadas(
  page: number,
  pageSize: number,
  incluirInactivos = false
): Promise<Pagina<UnidadMedida>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: incluirInactivos || undefined,
  });
  const response = await apiFetch(`${API_URL}/unidades-medida${query}`);

  return pedir<Pagina<UnidadMedida>>(response, "Error al obtener las unidades de medida");
}

export async function crearUnidadMedida(
  datos: Omit<UnidadMedida, "id" | "activo">
): Promise<UnidadMedida> {
  const response = await apiFetch(`${API_URL}/unidades-medida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<UnidadMedida>(response, "Error al crear la unidad de medida");
}

export async function modificarUnidadMedida(
  id: number,
  datos: Partial<Omit<UnidadMedida, "id">>
): Promise<UnidadMedida> {
  const response = await apiFetch(`${API_URL}/unidades-medida/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<UnidadMedida>(response, "Error al modificar la unidad de medida");
}

export async function eliminarUnidadMedida(id: number): Promise<UnidadMedida> {
  const response = await apiFetch(`${API_URL}/unidades-medida/${id}`, {
    method: "DELETE",
  });

  return pedir<UnidadMedida>(response, "Error al eliminar la unidad de medida");
}

export async function reactivarUnidadMedida(
  id: number,
  datos: Omit<UnidadMedida, "id" | "activo">
): Promise<UnidadMedida> {
  return modificarUnidadMedida(id, { ...datos, activo: true });
}

export async function obtenerUnidadMedida(id: number): Promise<UnidadMedida> {
  const response = await apiFetch(`${API_URL}/unidades-medida/${id}`);
  return pedir<UnidadMedida>(response, "Error al obtener la unidad de medida");
}