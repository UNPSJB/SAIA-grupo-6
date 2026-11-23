import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Establecimiento, EstablecimientoInput } from "../types/establecimiento";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Se emite al crear o modificar una sede: el selector de la barra se recarga. */
export const EVENTO_ESTABLECIMIENTOS = "saia:establecimientos-cambiaron";

function avisarCambio() {
  window.dispatchEvent(new Event(EVENTO_ESTABLECIMIENTOS));
}

/**
 * El super admin y los gerentes reciben todas las sedes; el resto, solo la
 * propia (lo decide el backend).
 */
export async function listarEstablecimientos(incluirInactivos = false): Promise<Establecimiento[]> {
  const query = incluirInactivos ? "?incluir_inactivos=true" : "";
  const response = await apiFetch(`${API_URL}/establecimientos${query}`);
  return pedir<Establecimiento[]>(response, "Error al obtener los establecimientos");
}

/** La sede en la que se está trabajando ahora. */
export async function obtenerEstablecimientoActual(): Promise<Establecimiento> {
  const response = await apiFetch(`${API_URL}/establecimientos/actual`);
  return pedir<Establecimiento>(response, "Error al obtener el establecimiento");
}

export async function crearEstablecimiento(datos: EstablecimientoInput): Promise<Establecimiento> {
  const response = await apiFetch(`${API_URL}/establecimientos`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  const creado = await pedir<Establecimiento>(response, "Error al crear el establecimiento");
  avisarCambio();
  return creado;
}

export async function modificarEstablecimiento(
  id: number,
  datos: EstablecimientoInput,
): Promise<Establecimiento> {
  const response = await apiFetch(`${API_URL}/establecimientos/${id}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  const modificado = await pedir<Establecimiento>(response, "Error al modificar el establecimiento");
  avisarCambio();
  return modificado;
}
