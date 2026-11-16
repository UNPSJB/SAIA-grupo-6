import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Proveedor, ProveedorFormValues } from "../types/proveedor";

export async function listarProveedores(
  incluirInactivos = false,
  buscar = "",
): Promise<Proveedor[]> {
  const params = new URLSearchParams();
  if (incluirInactivos) params.set("incluir_inactivos", "true");
  if (buscar.trim()) params.set("buscar", buscar.trim());
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/proveedores${query}`);

  return pedir<Proveedor[]>(response, "Error al obtener los proveedores");
}

export async function crearProveedor(
  datos: ProveedorFormValues
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
  datos: Partial<ProveedorFormValues> & { activo?: boolean }
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
  datos: ProveedorFormValues
): Promise<Proveedor> {
  return modificarProveedor(id, { ...datos, activo: true });
}

export async function obtenerProveedor(id: number): Promise<Proveedor> {
  const response = await apiFetch(`${API_URL}/proveedores/${id}`);
  return pedir<Proveedor>(response, "Error al obtener el proveedor");
}
export async function asociarInsumosProveedor(
  proveedorId: number,
  insumoIds: number[]
): Promise<Proveedor> {
  const response = await apiFetch(
    `${API_URL}/proveedores/${proveedorId}/insumos`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insumo_ids: insumoIds }),
    }
  );

  return pedir<Proveedor>(
    response,
    "Error al asociar los insumos al proveedor"
  );
}

export async function cargarCertificacionProveedor(
  proveedorId: number,
  datos: {
    tipo: string;
    numero: string;
    fecha_vencimiento: string;
    archivo: File;
  }
): Promise<Proveedor> {
  const formData = new FormData();
  formData.append("tipo", datos.tipo);
  formData.append("numero", datos.numero);
  formData.append("fecha_vencimiento", datos.fecha_vencimiento);
  formData.append("archivo", datos.archivo);

  const response = await apiFetch(
    `${API_URL}/proveedores/${proveedorId}/certificaciones`,
    {
      method: "POST",
      body: formData,
    }
  );

  return pedir<Proveedor>(
    response,
    "Error al cargar la certificación"
  );
}