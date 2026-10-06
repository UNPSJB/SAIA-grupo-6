import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoCreate,
  PlanCalibracionMantenimientoUpdate,
} from "../types/planCalibracionMantenimiento";
import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";

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
