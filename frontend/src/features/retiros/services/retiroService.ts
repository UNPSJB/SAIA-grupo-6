import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  ImpactoRetiro,
  RetiroCreateValues,
  RetiroCerrarValues,
  RetiroDetalle,
  RetiroNotificarValues,
  RetiroResumen,
} from "../types/retiro";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Lista de retiros con filtros opcionales. */
export async function listarRetiros({
  lote_id,
  estado,
  incidente_id,
}: {
  lote_id?: number;
  estado?: string;
  incidente_id?: number;
} = {}): Promise<RetiroResumen[]> {
  const params = new URLSearchParams();
  if (lote_id) params.set("lote_id", String(lote_id));
  if (estado) params.set("estado", estado);
  if (incidente_id) params.set("incidente_id", String(incidente_id));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/retiros${query}`);
  return pedir<RetiroResumen[]>(response, "Error al obtener los retiros");
}

/** Detalle completo de un retiro. */
export async function obtenerRetiro(retiroId: number): Promise<RetiroDetalle> {
  const response = await apiFetch(`${API_URL}/retiros/${retiroId}`);
  return pedir<RetiroDetalle>(response, "Error al obtener el retiro");
}

/** Inicia un retiro de lote del mercado (solo administración). */
export async function crearRetiro(
  datos: RetiroCreateValues
): Promise<RetiroDetalle> {
  const body: Record<string, unknown> = {
    lote_id: datos.lote_id,
    motivo: datos.motivo,
    detalle: datos.detalle,
    fecha_retiro: datos.fecha_retiro,
  };
  if (datos.reclamo_id) {
    body.reclamo_id = datos.reclamo_id;
  }
  const response = await apiFetch(`${API_URL}/retiros`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  return pedir<RetiroDetalle>(response, "Error al iniciar el retiro");
}

/** Notifica a un afectado por un retiro (puede operar). */
export async function notificarAfectado(
  retiroId: number,
  afectadoId: number,
  datos: RetiroNotificarValues
): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/retiros/${retiroId}/afectados/${afectadoId}/notificar`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        fecha_notificacion: datos.fecha_notificacion,
        medio_contacto: datos.medio_contacto ?? undefined,
        observacion: datos.observacion ?? undefined,
      }),
    }
  );
  await pedir<void>(response, "Error al notificar al afectado");
}

/** Cierra un retiro y su incidente vinculado (solo administración). */
export async function cerrarRetiro(
  retiroId: number,
  datos: RetiroCerrarValues
): Promise<RetiroDetalle> {
  const response = await apiFetch(`${API_URL}/retiros/${retiroId}/cerrar`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ accion_correctiva: datos.accion_correctiva.trim() }),
  });
  return pedir<RetiroDetalle>(response, "Error al cerrar el retiro");
}

/** Impacto de retirar un lote: reservas a cancelar y salidas afectadas. */
export async function obtenerImpactoRetiro(loteId: number): Promise<ImpactoRetiro> {
  const response = await apiFetch(`${API_URL}/lotes/${loteId}/impacto-retiro`);
  return pedir<ImpactoRetiro>(response, "Error al obtener el impacto del retiro");
}

/** Lote tal como lo devuelve `GET /salidas/lotes-disponibles`. */
export interface LoteDisponible {
  id: number;
  codigo: string;
  producto_nombre: string;
  unidad_medida: string;
  saldo: number | string;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
  retirado: boolean;
  retiro_id: number | null;
}

/** Lotes con saldo disponible para reservar (puede_operar). */
export async function listarLotesDisponibles(): Promise<LoteDisponible[]> {
  const response = await apiFetch(`${API_URL}/salidas/lotes-disponibles`);
  return pedir<LoteDisponible[]>(
    response,
    "Error al obtener los lotes disponibles",
  );
}
