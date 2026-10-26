import type { Calibracion, Equipo, TipoIntervencion, EquipoInput } from "../types/equipo";


import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";



export async function listarEquipos(incluirInactivos = false): Promise<Equipo[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/equipos${query}`);

  return pedir<Equipo[]>(response, "Error al obtener los equipos");
}

/**
 * Página de equipos para la tabla (paginación server-side). La lista completa
 * de arriba sigue existiendo para los dropdowns (reportar incidente, planes)
 * y el tablero, que necesitan todos los equipos de una vez.
 */
export async function listarEquiposPaginados(
  page: number,
  pageSize: number,
  incluirInactivos = false
): Promise<Pagina<Equipo>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: incluirInactivos || undefined,
  });
  const response = await apiFetch(`${API_URL}/equipos${query}`);

  return pedir<Pagina<Equipo>>(response, "Error al obtener los equipos");
}

export async function obtenerEquipo(id: number): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`);

  return pedir<Equipo>(response, "Error al obtener el equipo");
}

export async function crearEquipo(
  equipo: EquipoInput
): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  return pedir<Equipo>(response, "Error al crear el equipo");
}


export async function modificarEquipo(
  id: number,
  equipo: EquipoInput
): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(equipo),
  });

  return pedir<Equipo>(response, "Error al modificar el equipo");
}

export async function eliminarEquipo(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "DELETE",
  });

  return pedir<void>(response, "Error al eliminar el equipo");
}

export async function reactivarEquipo(id: number, equipo:EquipoInput ): Promise<Equipo> {
  const response = await apiFetch(`${API_URL}/equipos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...equipo, activo: true }),
  });
  return pedir<Equipo>(response, "Error al reactivar el equipo");
}

export async function registrarIntervencion(
  equipoId: number,
  fechaRealizacion: string,
  certificado: File,
  tipo: TipoIntervencion,
): Promise<Calibracion> {
  const formData = new FormData();
  formData.append("fecha_realizacion", fechaRealizacion);
  formData.append("certificado", certificado);
  formData.append("tipo", tipo);

  // Sin `Content-Type`: el browser tiene que poner el boundary del multipart.
  const response = await apiFetch(`${API_URL}/equipos/${equipoId}/calibraciones`, {
    method: "POST",
    body: formData,
  });

  return pedir<Calibracion>(response, "Error al registrar la intervención");
}

export async function obtenerHistorialCalibraciones(
  equipoId: number
): Promise<Calibracion[]> {
  const response = await apiFetch(`${API_URL}/equipos/${equipoId}/calibraciones`);

  return pedir<Calibracion[]>(
    response,
    "Error al obtener el historial de intervenciones"
  );
}
