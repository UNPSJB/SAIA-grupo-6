import type { Sector } from "../types/sector";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

export async function listarSectores(incluirInactivos = false): Promise<Sector[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/sectores${query}`);

  return pedir<Sector[]>(response, "Error al obtener los sectores");
}

export async function crearSector(
  datos: Omit<Sector, "id" | "activo">
): Promise<Sector> {
  const response = await apiFetch(`${API_URL}/sectores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Sector>(response, "Error al crear el sector");
}

export async function modificarSector(
  id: number,
  datos: Partial<Omit<Sector, "id">>
): Promise<Sector> {
  const response = await apiFetch(`${API_URL}/sectores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Sector>(response, "Error al modificar el sector");
}

export async function eliminarSector(id: number): Promise<Sector> {
  const response = await apiFetch(`${API_URL}/sectores/${id}`, {
    method: "DELETE",
  });

  return pedir<Sector>(response, "Error al eliminar el sector");
}

export async function reactivarSector(
  id: number,
  datos: Omit<Sector, "id" | "activo">
): Promise<Sector> {
  return modificarSector(id, { ...datos, activo: true });
}

export async function obtenerSector(id: number): Promise<Sector> {
  const response = await apiFetch(`${API_URL}/sectores/${id}`);
  return pedir<Sector>(response, "Error al obtener el sector");
}