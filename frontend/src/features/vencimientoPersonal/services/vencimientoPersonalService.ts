import type {
  VencimientoPersonal,
  VencimientoPersonalCreate,
  VencimientoPersonalUpdate,
} from "../types/vencimientoPersonal";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

export async function listarVencimientosDePersona(
  personaId: number
): Promise<VencimientoPersonal[]> {
  const response = await apiFetch(`${API_URL}/vencimientos-personal/persona/${personaId}`);
  return pedir<VencimientoPersonal[]>(response, "Error al obtener los vencimientos");
}

export async function crearVencimiento(
  datos: VencimientoPersonalCreate
): Promise<VencimientoPersonal> {
  const response = await apiFetch(`${API_URL}/vencimientos-personal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<VencimientoPersonal>(response, "Error al cargar el vencimiento");
}

export async function actualizarVencimiento(
  id: number,
  datos: VencimientoPersonalUpdate
): Promise<VencimientoPersonal> {
  const response = await apiFetch(`${API_URL}/vencimientos-personal/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<VencimientoPersonal>(response, "Error al actualizar el vencimiento");
}

export async function eliminarVencimiento(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/vencimientos-personal/${id}`, {
    method: "DELETE",
  });
  return pedir<void>(response, "Error al eliminar el vencimiento");
}