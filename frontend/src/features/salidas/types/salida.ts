import type { SalidaReclamoResumen } from "../../reclamos/types/reclamo";

export type EstadoSalida =
  | "RESERVADO"
  | "DESPACHADO"
  | "ENTREGADO"
  | "CANCELADO"
  | "RECHAZADA";

export const ESTADOS_SALIDA: { valor: EstadoSalida; etiqueta: string }[] = [
  { valor: "RESERVADO", etiqueta: "Reservado" },
  { valor: "DESPACHADO", etiqueta: "Despachado" },
  { valor: "ENTREGADO", etiqueta: "Entregado" },
  { valor: "CANCELADO", etiqueta: "Cancelado" },
  { valor: "RECHAZADA", etiqueta: "Rechazada" },
];

export type MotivoRechazo =
  | "dano_transporte"
  | "temperatura_inadecuada"
  | "producto_no_conforme"
  | "error_pedido"
  | "otro";

export const MOTIVOS_RECHAZO: { valor: MotivoRechazo; etiqueta: string }[] = [
  { valor: "dano_transporte", etiqueta: "Daño en el transporte" },
  { valor: "temperatura_inadecuada", etiqueta: "Temperatura inadecuada" },
  { valor: "producto_no_conforme", etiqueta: "Producto no conforme" },
  { valor: "error_pedido", etiqueta: "Error de pedido" },
  { valor: "otro", etiqueta: "Otro" },
];

export type DisposicionRechazo = "REINGRESADA" | "DESECHADA";

export const DISPOSICIONES_RECHAZO: {
  valor: DisposicionRechazo;
  etiqueta: string;
}[] = [
  { valor: "REINGRESADA", etiqueta: "Reingresar al lote" },
  { valor: "DESECHADA", etiqueta: "Desechar" },
];

export function etiquetaMotivoRechazo(
  motivo: string | null | undefined
): string {
  return (
    MOTIVOS_RECHAZO.find((m) => m.valor === motivo)?.etiqueta ?? motivo ?? "—"
  );
}

export const FORMAS_ENTREGA: { valor: string; etiqueta: string }[] = [
  { valor: "CON_TRANSPORTISTA", etiqueta: "Con transportista" },
  { valor: "RETIRA_CLIENTE", etiqueta: "Retira el cliente en planta" },
];

export interface SalidaCertificacion {
  id: number;
  tipo: string;
  numero: string;
  fecha_vencimiento: string;
  activa: boolean;
}

export interface Salida {
  id: number;
  lote_id: number;
  lote_numero: string;
  producto_nombre: string;
  unidad_medida: string;
  cliente_id: number;
  cliente_nombre: string;
  cliente_contacto: string | null;
  cliente_domicilio: string | null;
  cantidad: string;
  fecha_reserva: string;
  fecha_vencimiento: string | null;
  fecha_elaboracion: string | null;
  estado: EstadoSalida;
  creado_por_id: number | null;
  creado_por_nombre: string | null;
  creado_en: string | null;
  forma_entrega: string | null;
  transportista_id: number | null;
  transportista_nombre: string | null;
  fecha_despacho: string | null;
  fecha_entrega: string | null;
  despachado_en: string | null;
  entregado_en: string | null;
  observacion_entrega: string | null;
  motivo_cancelacion: string | null;
  cancelada_por_nombre: string | null;
  fecha_cancelacion: string | null;
  recibido_por: string | null;
  // Rechazo de la entrega y disposición posterior.
  motivo_rechazo: string | null;
  motivo_rechazo_label: string | null;
  detalle_rechazo: string | null;
  fecha_rechazo: string | null;
  rechazada_por_nombre: string | null;
  disposicion: DisposicionRechazo | null;
  justificacion_disposicion: string | null;
  fecha_disposicion: string | null;
  decidida_por_nombre: string | null;
  incidente_id: number | null;
  incidente_estado: "abierto" | "cerrado" | null;
  incidente_foto_url: string | null;
  lote_retirado: boolean;
  certificaciones: SalidaCertificacion[];
  /** Reclamos de cliente registrados sobre esta entrega (Historia 20). */
  reclamos: SalidaReclamoResumen[];
}

export interface SalidaCreateValues {
  lote_id: number;
  cliente_id: number;
  cantidad: string;
  fecha_reserva: string;
}

export interface SalidaDespacharValues {
  forma_entrega: string;
  transportista_id: number | null;
  fecha_despacho: string;
}

export interface SalidaEntregarValues {
  fecha_entrega: string;
  observacion: string | null;
  recibido_por: string | null;
  forma_entrega: string | null;
}

export interface SalidaCancelarValues {
  motivo: string;
}

export interface SalidaRechazarValues {
  motivo: MotivoRechazo;
  detalle: string;
  fecha_rechazo: string;
}

export interface SalidaResolverRechazoValues {
  disposicion: DisposicionRechazo;
  justificacion: string;
}

export interface HitoLote {
  id: number;
  lote_id: number;
  salida_id: number | null;
  fecha_hora: string;
  tipo_evento: string;
  descripcion: string;
  usuario_id: number;
  usuario_nombre: string | null;
}

export interface EstadoLoteSalidas {
  producido: string;
  reservado: string;
  despachado: string;
  entregado: string;
  en_revision: string;
  desechado: string;
  saldo: string;
  estado_lote: string;
}
