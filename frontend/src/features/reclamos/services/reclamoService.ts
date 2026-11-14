import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  ReclamoCreateValues,
  ReclamoDetalle,
  ReclamoResumen,
} from "../types/reclamo";

export interface FiltrosReclamos {
  cliente_id?: number;
  lote_id?: number;
  fuera_de_plazo?: boolean;
  /** Estado del incidente vinculado. */
  estado?: "abierto" | "cerrado";
  incidente_id?: number;
}

/** Clientes básicos (incluidos inactivos) para elegir en el alta de un reclamo. */
export async function obtenerClientesReclamo(): Promise<{
  id: number;
  nombre: string;
  activo: boolean;
}[]> {
  const response = await apiFetch(`${API_URL}/reclamos/clientes`);
  return pedir<{ id: number; nombre: string; activo: boolean }[]>(
    response,
    "Error al obtener los clientes"
  );
}

export async function listarReclamos(
  filtros: FiltrosReclamos = {}
): Promise<ReclamoResumen[]> {
  const params = new URLSearchParams();
  if (filtros.cliente_id) params.set("cliente_id", String(filtros.cliente_id));
  if (filtros.lote_id) params.set("lote_id", String(filtros.lote_id));
  if (filtros.fuera_de_plazo !== undefined) {
    params.set("fuera_de_plazo", String(filtros.fuera_de_plazo));
  }
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.incidente_id) {
    params.set("incidente_id", String(filtros.incidente_id));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/reclamos${query}`);
  return pedir<ReclamoResumen[]>(response, "Error al obtener los reclamos");
}

export async function obtenerReclamo(
  reclamoId: number
): Promise<ReclamoDetalle> {
  const response = await apiFetch(`${API_URL}/reclamos/${reclamoId}`);
  return pedir<ReclamoDetalle>(response, "Error al obtener el reclamo");
}

/**
 * Registra un reclamo. Multipart porque la foto es opcional, igual que el
 * rechazo de una entrega.
 */
export async function crearReclamo(
  datos: ReclamoCreateValues,
  foto?: File
): Promise<ReclamoDetalle> {
  const formData = new FormData();
  formData.append("salida_id", String(datos.salida_id));
  formData.append("motivo", datos.motivo);
  if (datos.detalle.trim()) {
    formData.append("detalle", datos.detalle.trim());
  }
  formData.append("fecha_reclamo", datos.fecha_reclamo);
  if (foto) {
    formData.append("foto", foto);
  }

  const response = await apiFetch(`${API_URL}/reclamos`, {
    method: "POST",
    body: formData,
  });
  return pedir<ReclamoDetalle>(response, "Error al registrar el reclamo");
}
