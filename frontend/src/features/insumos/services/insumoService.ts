import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  HomologacionInsumo,
  Insumo,
  InsumoCambios,
  InsumoInput,
  RotuloInsumoInput,
} from "../types/insumo";

export interface FiltrosInsumos {
  ingredienteId?: number;
  proveedorId?: number;
  incluirInactivos?: boolean;
}

export async function listarInsumos(filtros: FiltrosInsumos = {}): Promise<Insumo[]> {
  const params = new URLSearchParams();
  if (filtros.ingredienteId) params.set("ingrediente_id", String(filtros.ingredienteId));
  if (filtros.proveedorId) params.set("proveedor_id", String(filtros.proveedorId));
  if (filtros.incluirInactivos) params.set("incluir_inactivos", "true");
  const query = params.toString() ? `?${params}` : "";
  const response = await apiFetch(`${API_URL}/insumos${query}`);
  return pedir<Insumo[]>(response, "No se pudieron cargar los insumos");
}

export async function crearInsumo(datos: InsumoInput): Promise<Insumo> {
  const response = await apiFetch(`${API_URL}/insumos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  return pedir<Insumo>(response, "No se pudo crear el insumo");
}

export async function modificarInsumo(id: number, cambios: InsumoCambios): Promise<Insumo> {
  const response = await apiFetch(`${API_URL}/insumos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
  return pedir<Insumo>(response, "No se pudo modificar el insumo");
}

export async function darDeBajaInsumo(id: number): Promise<Insumo> {
  const response = await apiFetch(`${API_URL}/insumos/${id}`, { method: "DELETE" });
  return pedir<Insumo>(response, "No se pudo dar de baja el insumo");
}

export async function obtenerHomologacion(id: number): Promise<HomologacionInsumo> {
  const response = await apiFetch(`${API_URL}/insumos/${id}/homologacion`);
  return pedir<HomologacionInsumo>(response, "No se pudo cargar la homologación");
}

/** Reemplaza el rótulo de la marca y devuelve la comparación recalculada. */
export async function guardarRotulo(id: number, rotulo: RotuloInsumoInput): Promise<HomologacionInsumo> {
  const response = await apiFetch(`${API_URL}/insumos/${id}/rotulo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rotulo),
  });
  return pedir<HomologacionInsumo>(response, "No se pudo guardar el rótulo");
}

export async function decidirHomologacion(
  id: number,
  decision: "aprobar" | "rechazar",
  justificacion: string | null,
): Promise<HomologacionInsumo> {
  const response = await apiFetch(`${API_URL}/insumos/${id}/homologacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, justificacion }),
  });
  return pedir<HomologacionInsumo>(response, "No se pudo registrar la decisión");
}
