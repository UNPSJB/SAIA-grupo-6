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
  fecha_vencimiento: string | null;
  items_total: number;
  items_completados: number;
  // Campos de salidas (calculados en el backend, no persistidos).
  retirado: boolean;
  reservado: string;
  despachado: string;
  entregado: string;
  en_revision: string;
  desechado: string;
  saldo: string;
  estado_lote: string;
  // Retiro asociado al lote (si existe).
  retiro_id: number | null;
  retiro_estado: string | null;
  vida_util_dias: number | null;
}

export interface IngredientePlanificado {
  ingrediente_id: number;
  ingrediente_nombre: string;
  unidad: string;
  cantidad_planificada: string;
  consumo_real: string;
  desperdicio: string;
}

export interface Consumo {
  id: number;
  checklist_produccion_id: number;
  lote_insumo_id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  /** Marca del insumo del lote consumido. */
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
  /** Cómo se hace la etapa, según la versión de la receta del lote. */
  procedimiento: string | null;
  completado: boolean;
  completado_por_id: number | null;
  completado_por_nombre: string | null;
  completado_en: string | null;
  /** Persona que opera a la que se asignó la tarea; null = la hace cualquiera. */
  asignado_a_id: number | null;
  asignado_a_nombre: string | null;
  ingredientes: IngredientePlanificado[];
  consumos: Consumo[];
}

export interface LoteDetalle extends LoteResumen {
  checklist: ItemChecklist[];
  /** Solo en lotes terminados: si tiene rotulado completo (sin él no se vende). */
  rotulado_completo?: boolean | null;
}

export interface FiltrosLotes {
  estado?: EstadoLote | "";
  /** Id del producto; vacío = todos. */
  productoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

/** Cantidad objetivo de producto terminado o factor de la receta: uno de los dos. */
export interface LoteCreateValues {
  producto_id: number;
  cantidad_objetivo?: string;
  factor?: string;
  /** Solo quien administra: queda asignado a todas las tareas del lote. */
  responsable_id?: number | null;
}

export interface ConsumoInput {
  lote_insumo_id: number;
  cantidad: string;
  tipo: TipoConsumo;
  motivo?: string | null;
}
