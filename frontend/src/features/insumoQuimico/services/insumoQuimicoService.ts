import type { InsumoQuimico, InsumoQuimicoFormValues, InsumoQuimicoOpcion } from "../types/insumoQuimico";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function listarInsumosQuimicos(incluirInactivos = false): Promise<InsumoQuimico[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/insumos-quimicos${query}`);

  return pedir<InsumoQuimico[]>(response, "Error al obtener los insumos químicos");
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