import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { Conservacion, Cruzada, DeclaracionesOut, Evaluacion, Sustancia } from "../types/declaraciones";

const BASE = `${API_URL}/rotulado`;
export async function catalogoAlergenos(): Promise<Sustancia[]> {
  const datos = await pedir<{ sustancias: Sustancia[] }>(await apiFetch(`${BASE}/catalogo-alergenos`), "No se pudo cargar el catálogo de alérgenos");
  return datos.sustancias;
}
export async function consultarDeclaraciones(id: number): Promise<DeclaracionesOut> {
  return pedir(await apiFetch(`${BASE}/borradores/${id}/declaraciones`), "No se pudieron consultar las declaraciones");
}
export async function historialDeclaraciones(id: number): Promise<DeclaracionesOut[]> {
  return pedir(await apiFetch(`${BASE}/borradores/${id}/declaraciones/historial`), "No se pudo consultar el historial");
}
export async function guardarDeclaraciones(id: number, datos: {
  revision: number; conservacion: Conservacion | null; contaminacion_cruzada: Cruzada[]; evaluaciones: Evaluacion[];
}): Promise<DeclaracionesOut> {
  return pedir(await apiFetch(`${BASE}/borradores/${id}/declaraciones`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
  }), "No se pudieron guardar las declaraciones");
}
export async function regenerarDeclaraciones(id: number, revision: number, version_id?: number, usar_conservacion_producto = false): Promise<DeclaracionesOut> {
  return pedir(await apiFetch(`${BASE}/borradores/${id}/declaraciones/regenerar`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, version_id, usar_conservacion_producto }),
  }), "No se pudo regenerar la propuesta");
}
export async function confirmarDeclaraciones(id: number, revision: number): Promise<DeclaracionesOut> {
  return pedir(await apiFetch(`${BASE}/borradores/${id}/declaraciones/confirmar`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision }),
  }), "No se pudieron confirmar las declaraciones");
}
