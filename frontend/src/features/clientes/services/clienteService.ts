import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type { Cliente } from "../types/cliente";

export type ColumnaOrdenCliente = "nombre" | "documento" | "telefono";

export type OrdenCliente =
  | "nombre_asc"
  | "nombre_desc"
  | "documento_asc"
  | "documento_desc"
  | "telefono_asc"
  | "telefono_desc";

export async function listarClientes(
  incluirInactivos = false,
  buscar = "",
  page?: number,
  pageSize?: number,
  orden: OrdenCliente = "nombre_asc",
): Promise<Cliente[] | Pagina<Cliente>> {
  const params = new URLSearchParams();
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  if (buscar.trim()) params.set("buscar", buscar.trim());
  if (page) params.set("page", String(page));
  if (pageSize) params.set("page_size", String(pageSize));
  if (orden) params.set("orden", orden);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/clientes${query}`);

  return pedir<Cliente[] | Pagina<Cliente>>(response, "Error al obtener los clientes");
}

export async function listarClientesPaginados(
  page: number,
  pageSize: number,
  opciones: {
    incluirInactivos?: boolean;
    buscar?: string;
    orden?: OrdenCliente;
  } = {}
): Promise<Pagina<Cliente>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: opciones.incluirInactivos || undefined,
    buscar: opciones.buscar?.trim() || undefined,
    orden: opciones.orden || undefined,
  });
  const response = await apiFetch(`${API_URL}/clientes${query}`);

  return pedir<Pagina<Cliente>>(response, "Error al obtener los clientes");
}

export async function crearCliente(
  datos: Omit<Cliente, "id" | "activo">
): Promise<Cliente> {
  const response = await apiFetch(`${API_URL}/clientes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Cliente>(response, "Error al crear el cliente");
}

export async function modificarCliente(
  id: number,
  datos: Partial<Omit<Cliente, "id">>
): Promise<Cliente> {
  const response = await apiFetch(`${API_URL}/clientes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Cliente>(response, "Error al modificar el cliente");
}

export async function eliminarCliente(id: number): Promise<Cliente> {
  const response = await apiFetch(`${API_URL}/clientes/${id}`, {
    method: "DELETE",
  });

  return pedir<Cliente>(response, "Error al eliminar el cliente");
}

export async function reactivarCliente(
  id: number,
  datos: Omit<Cliente, "id" | "activo">
): Promise<Cliente> {
  return modificarCliente(id, { ...datos, activo: true });
}

export async function obtenerCliente(id: number): Promise<Cliente> {
  const response = await apiFetch(`${API_URL}/clientes/${id}`);
  return pedir<Cliente>(response, "Error al obtener el cliente");
}
