import type { UnidadMedida } from "../types/unidadMedida";
import { pedir } from "../../../common/api/errors";

import { apiFetch, API_URL } from "../../../common/api/apiClient";


export async function listarUnidadesMedida(incluirInactivos = false): Promise<UnidadMedida[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/unidades-medida${query}`);

  return pedir<UnidadMedida[]>(response, "Error al obtener las unidades de medida");
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