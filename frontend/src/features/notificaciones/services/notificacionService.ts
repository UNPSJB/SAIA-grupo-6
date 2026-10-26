import type { Notificacion } from "../types/notificacion";

import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";

/** Contadores de los dropdowns de filtro, calculados en el backend. */
export interface ContadoresNotificaciones {
  urgencia: { todas: number; vencidas: number; proximas: number };
  origen: {
    todas: number;
    ELEMENTO_LIMPIEZA: number;
    VENCIMIENTO_PERSONAL: number;
    PLAN_CALIBRACION: number;
    PLAN_MANTENIMIENTO: number;
  };
}

export interface NotificacionPagina extends Pagina<Notificacion> {
  contadores: ContadoresNotificaciones;
}

/** El listado completo (lo usa la campana del navbar, no la tabla). */
export async function obtenerNotificaciones(): Promise<Notificacion[]> {
  const response = await apiFetch(`${API_URL}/notificaciones`);
  return pedir<Notificacion[]>(response, "Error al obtener las notificaciones del sistema");
}

/**
 * Una página de notificaciones, con filtros + orden + contadores calculados
 * en el servidor. `orden` replica las columnas clickeables de la tabla:
 * urgencia (default, VENCIDOS arriba), estado, vencimiento y origen.
 */
export async function obtenerNotificacionesPaginadas(
  page: number,
  pageSize: number,
  filtros: {
    buscar?: string;
    urgencia?: string;
    origen?: string;
    orden?: string;
  } = {}
): Promise<NotificacionPagina> {
  const query = queryPagina(page, pageSize, {
    buscar: filtros.buscar?.trim() || undefined,
    urgencia: filtros.urgencia && filtros.urgencia !== "todas" ? filtros.urgencia : undefined,
    origen: filtros.origen && filtros.origen !== "todas" ? filtros.origen : undefined,
    orden: filtros.orden && filtros.orden !== "urgencia" ? filtros.orden : undefined,
  });
  const response = await apiFetch(`${API_URL}/notificaciones${query}`);
  return pedir<NotificacionPagina>(response, "Error al obtener las notificaciones del sistema");
}

export async function obtenerConfiguracionAlertas(): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`);
  return pedir<{ dias_alerta_vencimiento_personal: number }>(
    response,
    "Error al obtener la configuración de alertas"
  );
}

export async function actualizarConfiguracionAlertas(dias: number): Promise<{
  dias_alerta_vencimiento_personal: number;
}> {
  const response = await apiFetch(`${API_URL}/notificaciones/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dias_alerta_vencimiento_personal: dias }),
  });
  return pedir<{ dias_alerta_vencimiento_personal: number }>(
    response,
    "No se pudo guardar la configuración"
  );
}