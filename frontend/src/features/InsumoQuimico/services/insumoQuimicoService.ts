import type { InsumoQuimico } from "../types/insumoQuimico";
import { ConflictoInactivoError } from "../../../common/api/errors";

const API_URL = "http://localhost:8000";

export async function listarInsumosQuimicos(incluirInactivos = false): Promise<InsumoQuimico[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await fetch(`${API_URL}/insumos-quimicos${query}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener los insumos químicos");
  }

  return response.json();
}

export async function crearInsumoQuimico(
  datos: Omit<InsumoQuimico, "id" | "activo">
): Promise<InsumoQuimico> {
  const response = await fetch(`${API_URL}/insumos-quimicos`, {
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
    throw new Error(errorData?.detail || "Error al crear el insumo químico");
  }

  return response.json();
}

export async function modificarInsumoQuimico(
  id: number,
  datos: Partial<Omit<InsumoQuimico, "id">>
): Promise<InsumoQuimico> {
  const response = await fetch(`${API_URL}/insumos-quimicos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al modificar el insumo químico");
  }

  return response.json();
}

export async function eliminarInsumoQuimico(id: number): Promise<InsumoQuimico> {
  const response = await fetch(`${API_URL}/insumos-quimicos/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar el insumo químico");
  }

  return response.json();
}

export async function reactivarInsumoQuimico(
  id: number,
  datos: Omit<InsumoQuimico, "id" | "activo">
): Promise<InsumoQuimico> {
  return modificarInsumoQuimico(id, { ...datos, activo: true });
}

export async function obtenerInsumoQuimico(id: number): Promise<InsumoQuimico> {
  const response = await fetch(`${API_URL}/insumos-quimicos/${id}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el insumo químico");
  }
  return response.json();
}