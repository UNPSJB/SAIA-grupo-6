/**
 * Tipos del dominio de reposiciones (deuda comercial de stock con clientes
 * por reservas canceladas o entregas rechazadas).
 */

export type EstadoReposicion = "PENDIENTE" | "PARCIAL" | "CUMPLIDA" | "ANULADA";
export type PrioridadReposicion = "ALTA" | "NORMAL";
export type OrigenReposicion =
  | "RETIRO_LOTE"
  | "RECHAZO_ENTREGA"
  | "POR_RECLAMO";

export interface EntidadResumenReposicion {
  id: number;
  nombre: string;
}

export interface ProductoResumenReposicion extends EntidadResumenReposicion {
  unidad_medida?: string | null;
}

export interface Reposicion {
  id: number;
  cliente_id: number;
  producto_id: number;
  cantidad_original: string | number;
  cantidad_pendiente: string | number;
  estado: EstadoReposicion | string;
  prioridad: PrioridadReposicion | string;
  origen: OrigenReposicion | string;
  fecha_registro: string;
  motivo_anulacion: string | null;
  retiro_origen_id: number | null;
  salida_origen_id: number | null;
  incidente_origen_id: number | null;
  cliente: EntidadResumenReposicion;
  producto: ProductoResumenReposicion;
}
