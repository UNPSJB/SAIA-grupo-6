import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoCreate,
  PlanCalibracionMantenimientoUpdate,
} from "../types/planCalibracionMantenimiento";

const API_URL = "http://localhost:8000";

export async function listarPlanesCalibracionMantenimiento(
  incluirInactivos = false,
): Promise<PlanCalibracionMantenimiento[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await fetch(
    `${API_URL}/planes-calibracion-mantenimiento${query}`,
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
        "Error al obtener los planes de calibración y mantenimiento",
    );
  }

  return response.json();
}

export async function obtenerPlanCalibracionMantenimiento(
  id: number,
): Promise<PlanCalibracionMantenimiento> {
  const response = await fetch(
    `${API_URL}/planes-calibracion-mantenimiento/${id}`,
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
        "Error al obtener el plan de calibración y mantenimiento",
    );
  }

  return response.json();
}

export async function crearPlanCalibracionMantenimiento(
  plan: PlanCalibracionMantenimientoCreate,
): Promise<PlanCalibracionMantenimiento> {
  const response = await fetch(`${API_URL}/planes-calibracion-mantenimiento`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
        "Error al crear el plan de calibración y mantenimiento",
    );
  }

  return response.json();
}

export async function modificarPlanCalibracionMantenimiento(
  id: number,
  plan: PlanCalibracionMantenimientoUpdate,
): Promise<PlanCalibracionMantenimiento> {
  const response = await fetch(
    `${API_URL}/planes-calibracion-mantenimiento/${id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
        "Error al modificar el plan de calibración y mantenimiento",
    );
  }

  return response.json();
}
