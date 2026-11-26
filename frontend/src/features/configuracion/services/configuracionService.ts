import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type {
  CambioSituacion,
  ConfiguracionAlertas,
  ImpactoSituacion,
  PlazoReclamo,
} from "../types/configuracion";

export async function obtenerConfiguracionAlertas(): Promise<ConfiguracionAlertas> {
  const response = await apiFetch(`${API_URL}/configuracion/alertas`);
  return pedir<ConfiguracionAlertas>(
    response,
    "Error al obtener la configuración de alertas"
  );
}

/** Plazo de reclamos: lectura abierta a cualquier usuario autenticado. */
export async function obtenerPlazoReclamo(): Promise<PlazoReclamo> {
  const response = await apiFetch(`${API_URL}/configuracion/plazo-reclamo`);
  return pedir<PlazoReclamo>(
    response,
    "Error al obtener el plazo de reclamos"
  );
}

export async function actualizarConfiguracionAlertas(
  cambios: Partial<ConfiguracionAlertas>
): Promise<ConfiguracionAlertas> {
  const response = await apiFetch(`${API_URL}/configuracion/alertas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
  return pedir<ConfiguracionAlertas>(
    response,
    "No se pudo guardar la configuración"
  );
}

/** Impacto de cada tipo de situación del motor de riesgos (solo administración). */
export async function obtenerImpactoSituaciones(): Promise<ImpactoSituacion[]> {
  const response = await apiFetch(`${API_URL}/configuracion/impacto-situaciones`);
  return pedir<ImpactoSituacion[]>(
    response,
    "Error al obtener el impacto de los eventos"
  );
}

export async function fijarImpactoSituacion(
  tipo: string,
  cambio: CambioSituacion
): Promise<ImpactoSituacion> {
  const response = await apiFetch(
    `${API_URL}/configuracion/impacto-situaciones/${encodeURIComponent(tipo)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    }
  );
  return pedir<ImpactoSituacion>(response, "No se pudo guardar el impacto");
}

/** Vuelve al impacto sugerido por SAIA. */
export async function restaurarImpactoSituacion(
  tipo: string
): Promise<ImpactoSituacion> {
  const response = await apiFetch(
    `${API_URL}/configuracion/impacto-situaciones/${encodeURIComponent(tipo)}`,
    { method: "DELETE" }
  );
  return pedir<ImpactoSituacion>(response, "No se pudo restaurar el impacto");
}
