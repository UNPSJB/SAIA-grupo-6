import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Proveedor } from "../types/proveedor";

export async function listarProveedores(incluirInactivos = false): Promise<Proveedor[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/proveedores${query}`);

  return pedir<Proveedor[]>(response, "Error al obtener los proveedores");
}

export async function crearProveedor(
  datos: Omit<Proveedor, "id" | "activo">
): Promise<Proveedor> {
  const response = await apiFetch(`${API_URL}/proveedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Proveedor>(response, "Error al crear el proveedor");
}

export async function modificarProveedor(
  id: number,
  datos: Partial<Omit<Proveedor, "id">>
): Promise<Proveedor> {
  const response = await apiFetch(`${API_URL}/proveedores/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Proveedor>(response, "Error al modificar el proveedor");
}

export async function eliminarProveedor(id: number): Promise<Proveedor> {
  const response = await apiFetch(`${API_URL}/proveedores/${id}`, {
    method: "DELETE",
  });

  return pedir<Proveedor>(response, "Error al eliminar el proveedor");
}

export async function reactivarProveedor(
  id: number,
  datos: Omit<Proveedor, "id" | "activo">
): Promise<Proveedor> {
  return modificarProveedor(id, { ...datos, activo: true });
}

export async function obtenerProveedor(id: number): Promise<Proveedor> {
  const response = await apiFetch(`${API_URL}/proveedores/${id}`);
  return pedir<Proveedor>(response, "Error al obtener el proveedor");
}
