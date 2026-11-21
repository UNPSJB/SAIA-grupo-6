/**
 * Tipos del dominio de retiros de lote del mercado (Historia 21).
 *
 * Los nombres de propiedades y valores de enum coinciden exactamente con
 * los schemas del backend (`backend/src/retiros/schemas.py`).
 */

export type EstadoRetiro = "EN_CURSO" | "CERRADO";
export type OrigenRetiro = "MANUAL" | "RECLAMO";
export type EstadoNotificacion = "PENDIENTE" | "NOTIFICADO";

export const MOTIVOS_RETIRO: { valor: string; etiqueta: string }[] = [
  { valor: "Contaminación o cuerpo extraño", etiqueta: "Contaminación o cuerpo extraño" },
  { valor: "Reclamos de clientes", etiqueta: "Reclamos de clientes" },
  { valor: "Falla en el proceso de elaboración", etiqueta: "Falla en el proceso de elaboración" },
  { valor: "Insumo defectuoso", etiqueta: "Insumo defectuoso" },
  { valor: "Error de rotulado o alérgenos", etiqueta: "Error de rotulado o alérgenos" },
  { valor: "Otro", etiqueta: "Otro" },
];

export const MEDIOS_CONTACTO_RETIRO: { valor: string; etiqueta: string }[] = [
  { valor: "Teléfono", etiqueta: "Teléfono" },
  { valor: "Email", etiqueta: "Email" },
  { valor: "WhatsApp", etiqueta: "WhatsApp" },
  { valor: "Nota formal / Presencial", etiqueta: "Nota formal / Presencial" },
  { valor: "Otro", etiqueta: "Otro" },
];

export function etiquetaMotivoRetiro(motivo: string | null | undefined): string {
  return MOTIVOS_RETIRO.find((m) => m.valor === motivo)?.etiqueta ?? motivo ?? "—";
}

export function etiquetaOrigenRetiro(origen: string | null | undefined): string {
  return origen === "RECLAMO" ? "Reclamo de cliente" : "Manual";
}

/** Reclamo resumido (para el resumen del retiro). */
export interface RetiroResumen {
  id: number;
  lote_id: number;
  lote_codigo: string;
  lote_producto_nombre: string;
  motivo: string;
  detalle?: string | null;
  origen?: OrigenRetiro | string;
  fecha_retiro: string;
  estado: EstadoRetiro;
  iniciado_por_nombre: string;
  total_afectados: number;
  notificados: number;
}

/** Fila de afectado en el listado/detalle de retiros. */
export interface RetiroAfectadoResumen {
  id: number;
  salida_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cantidad_con_unidad: string;
  transportista: string;
  estado_salida: string;
  estado_notificacion: EstadoNotificacion;
  fecha_notificacion: string | null;
  medio_contacto: string | null;
  observacion: string | null;
  notificado_por: string | null;
}

/** Detalle completo de un retiro (GET /retiros/{id}). */
export interface RetiroDetalle {
  id: number;
  lote_id: number;
  lote_codigo: string;
  lote_producto_nombre: string;
  lote_unidad_medida: string;
  motivo: string;
  detalle: string | null;
  fecha_retiro: string;
  estado: EstadoRetiro;
  origen: OrigenRetiro;
  iniciado_por_nombre: string;
  fecha_registro: string;
  reclamo_id: number | null;
  incidente_id: number | null;
  incidente_estado: string | null;
  accion_correctiva: string | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
  saldo_en_planta: string;
  en_revision: string;
  afectados: RetiroAfectadoResumen[];
}

/** Salida afectada para GET /lotes/{lote_id}/impacto-retiro. */
export interface SalidaAfectadaResumen {
  salida_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cantidad_con_unidad: string;
  unidad_medida: string;
  transportista: string;
  estado: string;
}

/** Respuesta de GET /lotes/{lote_id}/impacto-retiro. */
export interface ImpactoRetiro {
  lote_id: number;
  lote_codigo: string;
  lote_producto_nombre: string;
  reservas_a_cancelar: number;
  salidas_afectadas: SalidaAfectadaResumen[];
  total_afectadas: number;
  saldo_en_planta: string;
  en_revision: string;
}

/** Valores para crear un retiro (POST /retiros). */
export interface RetiroCreateValues {
  lote_id: number;
  motivo: string;
  detalle: string | null;
  fecha_retiro: string;
  reclamo_id?: number;
}

export interface RetiroMasivoInsumoPayload {
  lote_insumo_id: number;
  lotes_producto_ids: number[];
  motivo: string;
  detalle?: string;
  fecha_retiro: string;
  desactivar_insumo: boolean;
}

export interface RetiroMasivoResponse {
  mensaje: string;
  lote_insumo_id: number;
  insumo_desactivado: boolean;
  retiros_creados: Array<{
    lote_id: number;
    numero_lote: string;
    retiro_id: number;
    clientes_afectados_count: number;
  }>;
}

/** Valores para cerrar un retiro (POST /retiros/{id}/cerrar). */
export interface RetiroCerrarValues {
  accion_correctiva: string;
}

/** Valores para notificar a un afectado (POST /retiros/{id}/afectados/{afectado_id}/notificar). */
export interface RetiroNotificarValues {
  fecha_notificacion: string;
  medio_contacto: string | null;
  observacion: string | null;
}
