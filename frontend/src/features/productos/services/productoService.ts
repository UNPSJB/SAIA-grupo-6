import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Producto, ProductoInput } from "../types/producto";

export async function listarProductos(
  incluirInactivos = false,
  buscar = "",
): Promise<Producto[]> {
  const params = new URLSearchParams();
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  if (buscar.trim()) params.set("buscar", buscar.trim());
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/productos${query}`);

  return pedir<Producto[]>(response, "Error al obtener los productos");
}

export async function obtenerProducto(id: number): Promise<Producto> {
  const response = await apiFetch(`${API_URL}/productos/${id}`);
  return pedir<Producto>(response, "Error al obtener el producto");
}

export async function crearProducto(datos: ProductoInput): Promise<Producto> {
  const response = await apiFetch(`${API_URL}/productos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<Producto>(response, "Error al crear el producto");
}

export async function modificarProducto(
  id: number,
  datos: Partial<ProductoInput> & { activo?: boolean },
): Promise<Producto> {
  const response = await apiFetch(`${API_URL}/productos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<Producto>(response, "Error al modificar el producto");
}

export async function eliminarProducto(id: number): Promise<Producto> {
  const response = await apiFetch(`${API_URL}/productos/${id}`, { method: "DELETE" });
  return pedir<Producto>(response, "Error al eliminar el producto");
}

export async function reactivarProducto(
  id: number,
  datos?: Partial<ProductoInput>,
): Promise<Producto> {
  return modificarProducto(id, { ...datos, activo: true });
}
