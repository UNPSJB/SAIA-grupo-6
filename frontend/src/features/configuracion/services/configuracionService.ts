import { pedir } from "../../../common/api/errors";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type {
  ConfiguracionAlertas,
  ConfiguracionPyme,
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
  impacto: number
): Promise<ImpactoSituacion> {
  const response = await apiFetch(
    `${API_URL}/configuracion/impacto-situaciones/${encodeURIComponent(tipo)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ impacto }),
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

/** Datos de identidad de la Pyme (los lee cualquier usuario autenticado). */
export async function obtenerConfiguracionPyme(): Promise<ConfiguracionPyme> {
  const response = await apiFetch(`${API_URL}/pyme`);
  return pedir<ConfiguracionPyme>(
    response,
    "Error al obtener los datos de la Pyme"
  );
}

export async function actualizarConfiguracionPyme(
  cambios: Partial<Omit<ConfiguracionPyme, "logo_url">>
): Promise<ConfiguracionPyme> {
  const response = await apiFetch(`${API_URL}/pyme`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
  return pedir<ConfiguracionPyme>(
    response,
    "No se pudieron guardar los datos de la Pyme"
  );
}

export async function subirLogoPyme(archivo: File): Promise<ConfiguracionPyme> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  // Sin Content-Type manual: el navegador agrega el boundary del multipart.
  const response = await apiFetch(`${API_URL}/pyme/logo`, {
    method: "POST",
    body: formulario,
  });
  return pedir<ConfiguracionPyme>(response, "No se pudo subir el logo");
}

export async function eliminarLogoPyme(): Promise<ConfiguracionPyme> {
  const response = await apiFetch(`${API_URL}/pyme/logo`, { method: "DELETE" });
  return pedir<ConfiguracionPyme>(response, "No se pudo quitar el logo");
}
