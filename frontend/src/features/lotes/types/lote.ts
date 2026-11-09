export type EstadoLote = "en_proceso" | "terminado" | "cancelado";
export type TipoConsumo = "real" | "desperdicio";

export const ESTADOS_LOTE: { valor: EstadoLote; etiqueta: string }[] = [
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "terminado", etiqueta: "Terminado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

export const esLoteCerrado = (estado: string) =>
  estado === "terminado" || estado === "cancelado";

export interface LoteResumen {
  id: number;
  numero_lote: string;
  producto_id: number;
  producto_nombre: string;
  unidad: string;
  version_receta_id: number | null;
  version_numero: number | null;
  estado: EstadoLote;
  cantidad_objetivo: string;
  factor_escala: string | null;
  cantidad_producida: string | null;
  motivo_cancelacion: string | null;
  creado_por_id: number | null;
  creado_por_nombre: string | null;
  fecha_inicio: string;
  fecha_cierre: string | null;
  items_total: number;
  items_completados: number;
}

export interface InsumoPlanificado {
  insumo_id: number;
  insumo_nombre: string;
  unidad: string;
  cantidad_planificada: string;
  consumo_real: string;
  desperdicio: string;
}

export interface Consumo {
  id: number;
  checklist_produccion_id: number;
  lote_insumo_id: number;
  insumo_id: number;
  insumo_nombre: string;
  numero_lote_insumo: string;
  proveedor_nombre: string;
  cantidad: string;
  tipo: TipoConsumo;
  motivo: string | null;
  registrado_por_id: number | null;
  registrado_por_nombre: string | null;
  registrado_en: string;
  advertencias: string[];
}

export interface ItemChecklist {
  id: number;
  tarea_receta_id: number;
  orden: number;
  descripcion: string;
  completado: boolean;
  completado_por_id: number | null;
  completado_por_nombre: string | null;
  completado_en: string | null;
  insumos: InsumoPlanificado[];
  consumos: Consumo[];
}

export interface LoteDetalle extends LoteResumen {
  checklist: ItemChecklist[];
}

export interface ProduccionPorProducto {
  producto: string;
  cantidad_producida: number;
  cantidad_lotes: number;
  /** Símbolo de la unidad del producto: "Kg", "un". */
  unidad: string;
}

export interface TotalPorUnidad {
  unidad: string;
  cantidad: number | string;
}

export interface LoteResumenEstado {
  estado: string;
  cantidad: number;
}

export interface DashboardLotes {
  total_lotes: number;
  /** Suma kilos con unidades: no mostrar. Usar `total_por_unidad`. */
  total_cantidad_producida: number;
  total_por_unidad: TotalPorUnidad[];
  por_estado: LoteResumenEstado[];
  por_producto: ProduccionPorProducto[];
}

export interface FiltrosLotes {
  estado?: EstadoLote | "";
  fechaDesde?: string;
  fechaHasta?: string;
}

/** Cantidad objetivo de producto terminado o factor de la receta: uno de los dos. */
export interface LoteCreateValues {
  producto_id: number;
  cantidad_objetivo?: string;
  factor?: string;
}

export interface ConsumoInput {
  lote_insumo_id: number;
  cantidad: string;
  tipo: TipoConsumo;
  motivo?: string | null;
}
