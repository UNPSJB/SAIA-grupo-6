import type {
  PlanLimpieza,
  TareaInput,
  EquipoOption,
  PersonalOption,
} from "../types/planLimpieza";

import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";


export interface PlanLimpiezaInput {
  nombre: string;
  tareas: TareaInput[];
  equipo_id: number;
  autor_id: number;
}

export async function listarPlanesLimpieza(
  incluirInactivos = false
): Promise<PlanLimpieza[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/planes-limpieza${query}`);

  return pedir<PlanLimpieza[]>(response, "Error al obtener los planes de limpieza");
}

export async function obtenerPlanLimpieza(id: number): Promise<PlanLimpieza> {
  const response = await apiFetch(`${API_URL}/planes-limpieza/${id}`);

  return pedir<PlanLimpieza>(response, "Error al obtener el plan de limpieza");
}

export async function crearPlanLimpieza(
  plan: PlanLimpiezaInput
): Promise<PlanLimpieza> {
  const response = await apiFetch(`${API_URL}/planes-limpieza`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  return pedir<PlanLimpieza>(response, "Error al crear el plan de limpieza");
}

export async function modificarPlanLimpieza(
  id: number,
  plan: PlanLimpiezaInput
): Promise<PlanLimpieza> {
  const response = await apiFetch(`${API_URL}/planes-limpieza/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });

  return pedir<PlanLimpieza>(response, "Error al modificar el plan de limpieza");
}

export async function eliminarPlanLimpieza(id: number): Promise<void> {
  const response = await apiFetch(`${API_URL}/planes-limpieza/${id}`, {
    method: "DELETE",
  });

  return pedir<void>(response, "Error al eliminar el plan de limpieza");
}

// --- Opciones para los <select> del formulario ---
// Se consultan las entidades relacionadas (equipos, personal) para que el
// usuario elija por nombre en lugar de tipear un ID a mano. Las tareas no
// se listan acá: ya no son un catálogo compartido, se cargan como parte
// del propio plan (ver PlanLimpiezaForm).

export async function listarOpcionesEquipos(): Promise<EquipoOption[]> {
  const response = await apiFetch(`${API_URL}/equipos`);

  return pedir<EquipoOption[]>(response, "Error al obtener los equipos");
}

export async function listarOpcionesPersonal(): Promise<PersonalOption[]> {
  const response = await apiFetch(`${API_URL}/personal`);

  return pedir<PersonalOption[]>(response, "Error al obtener el personal");
}

export async function reactivarPlanLimpieza(
  id: number,
  plan: PlanLimpiezaInput
): Promise<PlanLimpieza> {
  const response = await apiFetch(`${API_URL}/planes-limpieza/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...plan, activo: true }),
  });

  return pedir<PlanLimpieza>(response, "Error al reactivar el plan de limpieza");
}