import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoCreate,
  PlanCalibracionMantenimientoUpdate,
  TipoPlanCalibracionMantenimiento,
} from "../types/planCalibracionMantenimiento";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";

export type ColumnaOrdenPlanCalibracion =
  | "equipo"
  | "tipo"
  | "intervencion"
  | "periodicidad"
  | "vencimiento";
export type OrdenPlanCalibracion =
  | `${ColumnaOrdenPlanCalibracion}_asc`
  | `${ColumnaOrdenPlanCalibracion}_desc`;

export interface FiltrosPlanesCalibracion {
  incluirInactivos?: boolean;
  buscar?: string;
  tipo?: TipoPlanCalibracionMantenimiento | "";
  equipoId?: number;
  orden?: OrdenPlanCalibracion;
}

export async function listarPlanesCalibracionMantenimiento(
  incluirInactivos = false,
): Promise<PlanCalibracionMantenimiento[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(
    `${API_URL}/planes-calibracion-mantenimiento${query}`,
  );

  return pedir<PlanCalibracionMantenimiento[]>(
    response,
    "Error al obtener los planes de calibración y mantenimiento",
  );
}

/**
 * Página de planes para la tabla (paginación server-side). La lista completa
 * de arriba sigue existiendo para las pantallas de equipo, que muestran todos
 * los planes de un equipo de una vez.
 */
export async function listarPlanesCalibracionMantenimientoPaginados(
  page: number,
  pageSize: number,
  filtros: FiltrosPlanesCalibracion = {},
): Promise<Pagina<PlanCalibracionMantenimiento>> {
  const query = queryPagina(page, pageSize, {
    incluir_inactivos: filtros.incluirInactivos || undefined,
    buscar: filtros.buscar?.trim() || undefined,
    tipo: filtros.tipo || undefined,
    equipo_id: filtros.equipoId || undefined,
    orden: filtros.orden,
  });
  const response = await apiFetch(
    `${API_URL}/planes-calibracion-mantenimiento${query}`,
  );

  return pedir<Pagina<PlanCalibracionMantenimiento>>(
    response,
    "Error al obtener los planes de calibración y mantenimiento",
  );
}

export async function obtenerPlanCalibracionMantenimiento(
  id: number,
): Promise<PlanCalibracionMantenimiento> {
  const response = await apiFetch(
    `${API_URL}/planes-calibracion-mantenimiento/${id}`,
  );

  return pedir<PlanCalibracionMantenimiento>(
    response,
    "Error al obtener el plan de calibración y mantenimiento",
  );
}

export async function crearPlanCalibracionMantenimiento(
  plan: PlanCalibracionMantenimientoCreate,
): Promise<PlanCalibracionMantenimiento> {
  const response = await apiFetch(`${API_URL}/planes-calibracion-mantenimiento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  return pedir<PlanCalibracionMantenimiento>(
    response,
    "Error al crear el plan de calibración y mantenimiento",
  );
}

export async function modificarPlanCalibracionMantenimiento(
  id: number,
  plan: PlanCalibracionMantenimientoUpdate,
): Promise<PlanCalibracionMantenimiento> {
  const response = await apiFetch(
    `${API_URL}/planes-calibracion-mantenimiento/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    },
  );

  return pedir<PlanCalibracionMantenimiento>(
    response,
    "Error al modificar el plan de calibración y mantenimiento",
  );
}
/**
 * Baja lógica del plan. El backend expone `DELETE /planes-calibracion-mantenimiento/{id}`
 * y marca `activo = False`; el registro se puede reactivar con un PUT.
 */
export async function eliminarPlanCalibracionMantenimiento(
  id: number,
): Promise<PlanCalibracionMantenimiento> {
  const response = await apiFetch(
    `${API_URL}/planes-calibracion-mantenimiento/${id}`,
    { method: "DELETE" },
  );

  return pedir<PlanCalibracionMantenimiento>(
    response,
    "Error al eliminar el plan de calibración y mantenimiento",
  );
}
