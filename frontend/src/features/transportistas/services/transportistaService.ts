import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type { Transportista, TransportistaFormValues } from "../types/transportista";

export type ColumnaOrdenTransportista = "razon_social" | "cuit";

export type OrdenTransportista =
  | "razon_social_asc"
  | "razon_social_desc"
  | "cuit_asc"
  | "cuit_desc";

export async function listarTransportistas(
  incluirInactivos = false,
  buscar = "",
  page?: number,
  pageSize?: number,
  orden: OrdenTransportista = "razon_social_asc",
): Promise<Transportista[] | Pagina<Transportista>> {
  const params = new URLSearchParams();
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  if (buscar.trim()) params.set("buscar", buscar.trim());
  if (page) params.set("page", String(page));
  if (pageSize) params.set("page_size", String(pageSize));
  if (orden) params.set("orden", orden);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/transportistas${query}`);

  return pedir<Transportista[] | Pagina<Transportista>>(
    response,
    "Error al obtener los transportistas"
  );
}

export async function listarTransportistasPaginados(
  page: number,
  pageSize: number,
  opciones: {
    incluirInactivos?: boolean;
    buscar?: string;
    orden?: OrdenTransportista;
  } = {}
): Promise<Pagina<Transportista>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: opciones.incluirInactivos || undefined,
    buscar: opciones.buscar?.trim() || undefined,
    orden: opciones.orden || undefined,
  });
  const response = await apiFetch(`${API_URL}/transportistas${query}`);

  return pedir<Pagina<Transportista>>(
    response,
    "Error al obtener los transportistas"
  );
}

export async function crearTransportista(
  datos: TransportistaFormValues
): Promise<Transportista> {
  const response = await apiFetch(`${API_URL}/transportistas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Transportista>(response, "Error al crear el transportista");
}

export async function modificarTransportista(
  id: number,
  datos: Partial<Omit<Transportista, "id">>
): Promise<Transportista> {
  const response = await apiFetch(`${API_URL}/transportistas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });

  return pedir<Transportista>(response, "Error al modificar el transportista");
}

export async function eliminarTransportista(id: number): Promise<Transportista> {
  const response = await apiFetch(`${API_URL}/transportistas/${id}`, {
    method: "DELETE",
  });

  return pedir<Transportista>(response, "Error al eliminar el transportista");
}

export async function reactivarTransportista(
  id: number,
  datos: TransportistaFormValues
): Promise<Transportista> {
  return modificarTransportista(id, { ...datos, activo: true });
}

export async function obtenerTransportista(id: number): Promise<Transportista> {
  const response = await apiFetch(`${API_URL}/transportistas/${id}`);
  return pedir<Transportista>(response, "Error al obtener el transportista");
}
