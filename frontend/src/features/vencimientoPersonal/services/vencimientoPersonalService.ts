import type {
  VencimientoPersonal,
  VencimientoPersonalCreate,
  VencimientoPersonalUpdate,
} from "../types/vencimientoPersonal";

const API_URL = "http://localhost:8000";

export async function listarVencimientosDePersona(
  personaId: number
): Promise<VencimientoPersonal[]> {
  const response = await fetch(`${API_URL}/vencimientos-personal/persona/${personaId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener los vencimientos");
  }
  return response.json();
}

export async function crearVencimiento(
  datos: VencimientoPersonalCreate
): Promise<VencimientoPersonal> {
  const response = await fetch(`${API_URL}/vencimientos-personal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al cargar el vencimiento");
  }
  return response.json();
}

export async function actualizarVencimiento(
  id: number,
  datos: VencimientoPersonalUpdate
): Promise<VencimientoPersonal> {
  const response = await fetch(`${API_URL}/vencimientos-personal/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al actualizar el vencimiento");
  }
  return response.json();
}

export async function eliminarVencimiento(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/vencimientos-personal/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar el vencimiento");
  }
}