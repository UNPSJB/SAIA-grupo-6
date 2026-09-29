import type { UnidadMedida } from "../types/unidadMedida";
import { ConflictoInactivoError } from "../../../common/api/errors";

const API_URL = "http://localhost:8000";

export async function listarUnidadesMedida(incluirInactivos = false): Promise<UnidadMedida[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await fetch(`${API_URL}/unidades-medida${query}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener las unidades de medida");
  }

  return response.json();
}

export async function crearUnidadMedida(
  datos: Omit<UnidadMedida, "id" | "activo">
): Promise<UnidadMedida> {
  const response = await fetch(`${API_URL}/unidades-medida`, {
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
    throw new Error(errorData?.detail || "Error al crear la unidad de medida");
  }

  return response.json();
}

export async function modificarUnidadMedida(
  id: number,
  datos: Partial<Omit<UnidadMedida, "id">>
): Promise<UnidadMedida> {
  const response = await fetch(`${API_URL}/unidades-medida/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al modificar la unidad de medida");
  }

  return response.json();
}

export async function eliminarUnidadMedida(id: number): Promise<UnidadMedida> {
  const response = await fetch(`${API_URL}/unidades-medida/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar la unidad de medida");
  }

  return response.json();
}

export async function reactivarUnidadMedida(
  id: number,
  datos: Omit<UnidadMedida, "id" | "activo">
): Promise<UnidadMedida> {
  return modificarUnidadMedida(id, { ...datos, activo: true });
}

export async function obtenerUnidadMedida(id: number): Promise<UnidadMedida> {
  const response = await fetch(`${API_URL}/unidades-medida/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener la unidad de medida");
  }
  return response.json();
}
