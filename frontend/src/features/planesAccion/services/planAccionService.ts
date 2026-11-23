import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import { queryPagina, type Pagina } from "../../../common/api/paginacion";
import type {
  AccionInput,
  GrupoPlan,
  ObservacionTipo,
  PlanCambios,
  PlanDetalle,
  PlanInput,
  PlanResumen,
  ResponsablePosible,
  SituacionConPlan,
  SituacionDisponible,
} from "../types/planAccion";

const BASE = `${API_URL}/planes-accion`;

const JSON_HEADERS = { "Content-Type": "application/json" };

function enviarJson(metodo: string, cuerpo?: unknown): RequestInit {
  return {
    method: metodo,
    headers: JSON_HEADERS,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  };
}

// ---------------------------------------------------------------- Listados

export interface FiltrosPlanes {
  grupo?: GrupoPlan | "";
  estado?: string;
  tipo?: string;
  buscar?: string;
  vencidos?: boolean;
}

export async function listarPlanes(
  page: number,
  pageSize: number,
  filtros: FiltrosPlanes = {},
): Promise<Pagina<PlanResumen>> {
  const query = queryPagina(page, pageSize, {
    grupo: filtros.grupo || undefined,
    estado: filtros.estado || undefined,
    tipo: filtros.tipo || undefined,
    buscar: filtros.buscar?.trim() || undefined,
    vencidos: filtros.vencidos || undefined,
  });
  const response = await apiFetch(`${BASE}${query}`);
  return pedir<Pagina<PlanResumen>>(response, "Error al obtener los planes de acción");
}

export async function obtenerPlan(id: number): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${id}`);
  return pedir<PlanDetalle>(response, "Error al obtener el plan de acción");
}

export async function listarSituacionesDisponibles(
  tipo?: string,
): Promise<SituacionDisponible[]> {
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  const response = await apiFetch(`${BASE}/situaciones-disponibles${query}`);
  return pedir<SituacionDisponible[]>(response, "Error al obtener las situaciones");
}

export async function listarSituacionesConPlan(): Promise<SituacionConPlan[]> {
  const response = await apiFetch(`${BASE}/situaciones-con-plan`);
  return pedir<SituacionConPlan[]>(response, "Error al obtener los planes de las situaciones");
}

export async function listarCandidatas(planId: number): Promise<SituacionDisponible[]> {
  const response = await apiFetch(`${BASE}/${planId}/situaciones-candidatas`);
  return pedir<SituacionDisponible[]>(response, "Error al obtener las situaciones candidatas");
}

export async function listarResponsables(): Promise<ResponsablePosible[]> {
  const response = await apiFetch(`${BASE}/responsables`);
  return pedir<ResponsablePosible[]>(response, "Error al obtener los responsables");
}

// --------------------------------------------------------------- Escritura

export async function crearPlan(datos: PlanInput): Promise<PlanDetalle> {
  const response = await apiFetch(BASE, enviarJson("POST", datos));
  return pedir<PlanDetalle>(response, "Error al crear el plan de acción");
}

export async function actualizarPlan(id: number, cambios: PlanCambios): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${id}`, enviarJson("PATCH", cambios));
  return pedir<PlanDetalle>(response, "Error al actualizar el plan");
}

export async function confirmarPlan(id: number): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${id}/confirmar`, { method: "POST" });
  return pedir<PlanDetalle>(response, "Error al confirmar el plan");
}

export async function cancelarPlan(id: number, motivo: string): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${id}/cancelar`, enviarJson("POST", { motivo }));
  return pedir<PlanDetalle>(response, "Error al cancelar el plan");
}

export async function verificarPlan(id: number): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${id}/verificar`, { method: "POST" });
  return pedir<PlanDetalle>(response, "Error al verificar el plan");
}

export async function agregarAccion(planId: number, accion: AccionInput): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${planId}/acciones`, enviarJson("POST", accion));
  return pedir<PlanDetalle>(response, "Error al agregar la acción");
}

export async function actualizarAccion(
  planId: number,
  accionId: number,
  cambios: Partial<AccionInput>,
): Promise<PlanDetalle> {
  const response = await apiFetch(
    `${BASE}/${planId}/acciones/${accionId}`,
    enviarJson("PATCH", cambios),
  );
  return pedir<PlanDetalle>(response, "Error al actualizar la acción");
}

export async function eliminarAccion(planId: number, accionId: number): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${planId}/acciones/${accionId}`, {
    method: "DELETE",
  });
  return pedir<PlanDetalle>(response, "Error al quitar la acción");
}

export async function completarAccion(
  planId: number,
  accionId: number,
  descripcion: string,
  archivo?: File | null,
): Promise<PlanDetalle> {
  const formData = new FormData();
  formData.append("descripcion", descripcion);
  if (archivo) formData.append("archivo", archivo);
  const response = await apiFetch(`${BASE}/${planId}/acciones/${accionId}/completar`, {
    method: "POST",
    body: formData,
  });
  return pedir<PlanDetalle>(response, "Error al completar la acción");
}

export async function agregarSituaciones(
  planId: number,
  situacionIds: number[],
  confirmaCausaCompatible: boolean,
): Promise<PlanDetalle> {
  const response = await apiFetch(
    `${BASE}/${planId}/situaciones`,
    enviarJson("POST", {
      situacion_ids: situacionIds,
      confirma_causa_compatible: confirmaCausaCompatible,
    }),
  );
  return pedir<PlanDetalle>(response, "Error al sumar las situaciones");
}

export async function quitarSituacion(
  planId: number,
  situacionPlanId: number,
): Promise<PlanDetalle> {
  const response = await apiFetch(`${BASE}/${planId}/situaciones/${situacionPlanId}`, {
    method: "DELETE",
  });
  return pedir<PlanDetalle>(response, "Error al quitar la situación");
}

export async function verificarSituacion(
  planId: number,
  situacionPlanId: number,
  opciones: {
    descripcion?: string;
    resultado?: "corregida" | "no_eficaz";
    archivo?: File | null;
  },
): Promise<PlanDetalle> {
  const formData = new FormData();
  if (opciones.descripcion?.trim()) formData.append("descripcion", opciones.descripcion.trim());
  if (opciones.resultado) formData.append("resultado", opciones.resultado);
  if (opciones.archivo) formData.append("archivo", opciones.archivo);
  const response = await apiFetch(`${BASE}/${planId}/situaciones/${situacionPlanId}/verificar`, {
    method: "POST",
    body: formData,
  });
  return pedir<PlanDetalle>(response, "Error al verificar la situación");
}

// ----------------------------------------------------------- Configuración

export async function listarObservacion(): Promise<ObservacionTipo[]> {
  const response = await apiFetch(`${BASE}/configuracion/observacion`);
  return pedir<ObservacionTipo[]>(response, "Error al obtener los períodos de observación");
}

export async function fijarObservacion(tipo: string, dias: number): Promise<ObservacionTipo> {
  const response = await apiFetch(
    `${BASE}/configuracion/observacion/${encodeURIComponent(tipo)}`,
    enviarJson("PUT", { dias }),
  );
  return pedir<ObservacionTipo>(response, "Error al guardar el período de observación");
}

export async function restablecerObservacion(tipo: string): Promise<ObservacionTipo> {
  const response = await apiFetch(
    `${BASE}/configuracion/observacion/${encodeURIComponent(tipo)}`,
    { method: "DELETE" },
  );
  return pedir<ObservacionTipo>(response, "Error al restablecer el período de observación");
}
