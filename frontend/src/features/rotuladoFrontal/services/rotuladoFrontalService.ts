import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  AjusteModuloRotulado,
  ConfiguracionRotuladoInput,
  EvaluacionRotulado,
  ReglaRotulado,
  ReglaRotuladoInput,
} from "../types/rotuladoFrontal";

const BASE = `${API_URL}/rotulado-frontal`;

function json(method: string, datos: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  };
}

export async function evaluarRotulado(
  productoId: number,
  versionId?: number,
): Promise<EvaluacionRotulado> {
  const query = versionId ? `?version_id=${versionId}` : "";
  return pedir<EvaluacionRotulado>(
    await apiFetch(`${BASE}/productos/${productoId}${query}`),
    "No se pudo evaluar el rotulado frontal",
  );
}

export async function guardarRotulado(
  productoId: number,
  datos: ConfiguracionRotuladoInput,
): Promise<EvaluacionRotulado> {
  return pedir<EvaluacionRotulado>(
    await apiFetch(`${BASE}/productos/${productoId}`, json("PUT", datos)),
    "No se pudo guardar la configuración de rotulado frontal",
  );
}

export async function obtenerAjusteModulo(): Promise<AjusteModuloRotulado> {
  return pedir<AjusteModuloRotulado>(
    await apiFetch(`${BASE}/ajuste-modulo`),
    "No se pudo cargar el estado del módulo de rotulado frontal",
  );
}

export async function guardarAjusteModulo(
  moduloActivo: boolean,
): Promise<AjusteModuloRotulado> {
  return pedir<AjusteModuloRotulado>(
    await apiFetch(
      `${BASE}/ajuste-modulo`,
      json("PUT", { modulo_activo: moduloActivo }),
    ),
    "No se pudo actualizar el módulo de rotulado frontal",
  );
}

export async function listarReglas(): Promise<ReglaRotulado[]> {
  return pedir<ReglaRotulado[]>(
    await apiFetch(`${BASE}/reglas`),
    "No se pudieron cargar las reglas de rotulado frontal",
  );
}

export async function crearRegla(datos: ReglaRotuladoInput): Promise<ReglaRotulado> {
  return pedir<ReglaRotulado>(
    await apiFetch(`${BASE}/reglas`, json("POST", datos)),
    "No se pudo crear la versión de la regla",
  );
}

export async function activarRegla(reglaId: number): Promise<ReglaRotulado> {
  return pedir<ReglaRotulado>(
    await apiFetch(`${BASE}/reglas/${reglaId}/activar`, { method: "POST" }),
    "No se pudo activar la versión de la regla",
  );
}
