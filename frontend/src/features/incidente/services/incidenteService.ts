import type { Incidente, IncidenteFormValues, EstadoIncidente, HistorialIncidenteResponse, IncidenteResumen } from "../types/incidente";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

/**
 * Lista los incidentes del más reciente al más viejo.
 * Sin `estado` llegan abiertos y cerrados.
 */
export async function listarIncidentes(
  estado?: EstadoIncidente | "",
  tipo?: string,
  equipoId?: number
): Promise<Incidente[]> {
  const params = new URLSearchParams();
  if (estado) params.append("estado", estado);
  if (tipo) params.append("tipo", tipo);
  if (equipoId) params.append("equipo_id", String(equipoId));

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/incidentes${query}`);

  return pedir<Incidente[]>(response, "Error al obtener los incidentes");
}

export async function listarMisIncidentes(): Promise<Incidente[]> {
  const response = await apiFetch(`${API_URL}/incidentes/mios`);

  return pedir<Incidente[]>(response, "Error al obtener tus incidentes");
}

export async function obtenerIncidente(id: number): Promise<Incidente> {
  const response = await apiFetch(`${API_URL}/incidentes/${id}`);

  return pedir<Incidente>(response, "Error al obtener el incidente");
}

export async function crearIncidente(
  datos: IncidenteFormValues,
  foto?: File
): Promise<Incidente> {
  const formData = new FormData();
  formData.append("titulo", datos.titulo);
  formData.append("descripcion", datos.descripcion);
  formData.append("tipo", datos.tipo);
  if (datos.equipo_id) {
    formData.append("equipo_id", String(datos.equipo_id));
  }
  // usuario_id se toma del token JWT en el backend
  if (foto) {
    formData.append("foto", foto);
  }

  const response = await apiFetch(`${API_URL}/incidentes`, {
    method: "POST",
    body: formData,
  });

  return pedir<Incidente>(response, "Error al crear el incidente");
}

/**
 * Cierra o reabre un incidente.
 *
 * La fecha de cierre y el responsable los completa el backend a partir del
 * token: el frontend solo manda el estado y la observación (la acción
 * correctiva al cerrar, o el motivo de reapertura al reabrir). El backend
 * guarda esa observación en el historial en ambos casos.
 */
export async function cambiarEstadoIncidente(
  id: number,
  estado: EstadoIncidente,
  observacion_cierre?: string
): Promise<Incidente> {
  const response = await apiFetch(`${API_URL}/incidentes/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      estado,
      observacion_cierre: observacion_cierre?.trim() ? observacion_cierre.trim() : null,
    }),
  });

  return pedir<Incidente>(response, "Error al cambiar el estado del incidente");
}

/**
 * Obtiene el historial de cierre/reapertura de un incidente.
 */
export async function obtenerHistorialIncidente(
  id: number
): Promise<HistorialIncidenteResponse> {
  const response = await apiFetch(`${API_URL}/incidentes/${id}/historial`);

  return pedir<HistorialIncidenteResponse>(response, "Error al obtener el historial del incidente");
}

/**
 * Indicador "incidentes por tipo" (E7).
 *
 * Por defecto cuenta solo los incidentes abiertos (sin acción correctiva
 * registrada). Con `incluirCerrados` cuenta el histórico completo.
 */
export async function obtenerResumenIncidentesPorTipo(
  incluirCerrados = false
): Promise<IncidenteResumen> {
  const query = incluirCerrados ? "?incluir_cerrados=true" : "";
  const response = await apiFetch(
    `${API_URL}/incidentes/resumen-por-tipo${query}`
  );

  return pedir<IncidenteResumen>(
    response,
    "Error al obtener los incidentes por tipo"
  );
}