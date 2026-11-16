import { apiFetch, API_URL } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type {
  EstadoSalida,
  HitoLote,
  Salida,
  SalidaCancelarValues,
  SalidaCreateValues,
  SalidaDespacharValues,
  SalidaEntregarValues,
  SalidaRechazarValues,
  SalidaResolverRechazoValues,
} from "../types/salida";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function reservarSalida(
  datos: SalidaCreateValues
): Promise<Salida> {
  const response = await apiFetch(`${API_URL}/salidas/reservar`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(datos),
  });
  return pedir<Salida>(response, "Error al reservar la salida");
}

export async function listarSalidas({
  estado,
  lote_id,
  cliente_id,
}: {
  estado?: EstadoSalida | "";
  lote_id?: number;
  cliente_id?: number;
}): Promise<Salida[]> {
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (lote_id) params.set("lote_id", String(lote_id));
  if (cliente_id) params.set("cliente_id", String(cliente_id));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/salidas${query}`);
  return pedir<Salida[]>(response, "Error al obtener las salidas");
}

export async function obtenerSalida(salidaId: number): Promise<Salida> {
  const response = await apiFetch(`${API_URL}/salidas/${salidaId}`);
  return pedir<Salida>(response, "Error al obtener la salida");
}

export async function despacharSalida(
  salidaId: number,
  datos: SalidaDespacharValues
): Promise<Salida> {
  const response = await apiFetch(
    `${API_URL}/salidas/${salidaId}/despachar`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(datos),
    }
  );
  return pedir<Salida>(response, "Error al despachar la salida");
}

export async function entregarSalida(
  salidaId: number,
  datos: SalidaEntregarValues
): Promise<Salida> {
  const response = await apiFetch(
    `${API_URL}/salidas/${salidaId}/entregar`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(datos),
    }
  );
  return pedir<Salida>(response, "Error al registrar la entrega");
}

export async function cancelarSalida(
  salidaId: number,
  datos: SalidaCancelarValues
): Promise<Salida> {
  const response = await apiFetch(
    `${API_URL}/salidas/${salidaId}/cancelar`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(datos),
    }
  );
  return pedir<Salida>(response, "Error al cancelar la salida");
}

export async function rechazarSalida(
  salidaId: number,
  datos: SalidaRechazarValues,
  foto?: File
): Promise<Salida> {
  const formData = new FormData();
  formData.append("motivo", datos.motivo);
  if (datos.detalle.trim()) {
    formData.append("detalle", datos.detalle.trim());
  }
  formData.append("fecha_rechazo", datos.fecha_rechazo);
  if (foto) {
    formData.append("foto", foto);
  }

  const response = await apiFetch(`${API_URL}/salidas/${salidaId}/rechazar`, {
    method: "POST",
    body: formData,
  });
  return pedir<Salida>(response, "Error al registrar el rechazo");
}

export async function resolverRechazo(
  salidaId: number,
  datos: SalidaResolverRechazoValues
): Promise<Salida> {
  const response = await apiFetch(
    `${API_URL}/salidas/${salidaId}/resolver-rechazo`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        disposicion: datos.disposicion,
        justificacion: datos.justificacion.trim(),
      }),
    }
  );
  return pedir<Salida>(response, "Error al resolver el rechazo");
}

export async function listarHitosLote(loteId: number): Promise<HitoLote[]> {
  const response = await apiFetch(
    `${API_URL}/lotes/${loteId}/hitos`
  );
  return pedir<HitoLote[]>(response, "Error al obtener los hitos del lote");
}

/** Clientes activos para elegir al reservar una salida (puede_operar). */
export async function listarClientesDisponibles(): Promise<{
  id: number;
  nombre: string;
}[]> {
  const response = await apiFetch(`${API_URL}/salidas/clientes-disponibles`);
  return pedir<{ id: number; nombre: string }[]>(
    response,
    "Error al obtener los clientes disponibles"
  );
}

/** Lotes con saldo disponible para reservar (puede_operar). */
export async function listarLotesDisponibles(): Promise<{
  id: number;
  codigo: string;
  producto_nombre: string;
  unidad_medida: string;
  saldo: number | string;
  fecha_inicio: string | null;
  fecha_vencimiento: string | null;
}[]> {
  const response = await apiFetch(`${API_URL}/salidas/lotes-disponibles`);
  return pedir<
    {
      id: number;
      codigo: string;
      producto_nombre: string;
      unidad_medida: string;
      saldo: number | string;
      fecha_inicio: string | null;
      fecha_vencimiento: string | null;
    }[]
  >(response, "Error al obtener los lotes disponibles");
}
