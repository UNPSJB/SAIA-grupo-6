import type { Incidente, IncidenteFormValues } from "../types/incidente";

const API_URL = "http://localhost:8000";

export async function listarIncidentes(
  incluirInactivos = false,
  tipo?: string,
  equipoId?: number
): Promise<Incidente[]> {
  const params = new URLSearchParams();
  if (incluirInactivos) params.append("incluir_inactivos", "true");
  if (tipo) params.append("tipo", tipo);
  if (equipoId) params.append("equipo_id", String(equipoId));

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/incidentes${query}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener los incidentes");
  }

  return response.json();
}

export async function obtenerIncidente(id: number): Promise<Incidente> {
  const response = await fetch(`${API_URL}/incidentes/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al obtener el incidente");
  }

  return response.json();
}

export async function crearIncidente(
  datos: IncidenteFormValues,
  usuarioId: number,
  foto?: File
): Promise<Incidente> {
  const formData = new FormData();
  formData.append("descripcion", datos.descripcion);
  formData.append("tipo", datos.tipo);
  if (datos.equipo_id) {
    formData.append("equipo_id", String(datos.equipo_id));
  }
  formData.append("usuario_id", String(usuarioId));
  if (foto) {
    formData.append("foto", foto);
  }

  const response = await fetch(`${API_URL}/incidentes`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al crear el incidente");
  }

  return response.json();
}

export async function eliminarIncidente(id: number): Promise<Incidente> {
  const response = await fetch(`${API_URL}/incidentes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "Error al eliminar el incidente");
  }

  return response.json();
}
