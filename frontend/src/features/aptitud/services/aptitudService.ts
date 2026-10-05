import type { Aptitud } from "../types/aptitud";
import { ConflictoInactivoError } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

export async function listarAptitudes(incluirInactivos = false): Promise<Aptitud[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/aptitudes${query}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener las aptitudes");
  }

  return response.json();
}

export async function crearAptitud(
  datos: Omit<Aptitud, "id" | "activo">
): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  if (response.status === 409) {
    const errorData = await response.json().catch(() => null);
    const detail = errorData?.detail;
    if (detail && typeof detail === "object" && detail.tipo === "inactivo") {
      throw new ConflictoInactivoError(detail.mensaje, detail.id, detail.campo);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al crear la aptitud");
  }

  return response.json();
}

export async function modificarAptitud(
  id: number,
  datos: Partial<Omit<Aptitud, "id">>
): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al modificar la aptitud");
  }

  return response.json();
}

export async function eliminarAptitud(id: number): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar la aptitud");
  }

  return response.json();
}

export async function reactivarAptitud(
  id: number,
  datos: Omit<Aptitud, "id" | "activo">
): Promise<Aptitud> {
  return modificarAptitud(id, { ...datos, activo: true });
}

export async function obtenerAptitud(id: number): Promise<Aptitud> {
  const response = await apiFetch(`${API_URL}/aptitudes/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener la aptitud");
  }
  return response.json();
}
