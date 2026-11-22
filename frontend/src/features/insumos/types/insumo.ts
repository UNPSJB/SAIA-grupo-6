/**
 * Insumo: el producto concreto que se compra, una marca de un ingrediente.
 *
 * El ingrediente es la especificación que usan la receta y la tabla
 * nutricional ("Harina 000"); el insumo es lo que llega del proveedor
 * ("Harina 000 Marca A"). Los lotes recibidos apuntan al insumo.
 */
export interface Insumo {
  id: number;
  ingrediente_id: number;
  ingrediente_nombre: string;
  /** Símbolo de la unidad del ingrediente. */
  unidad: string;
  marca: string;
  descripcion: string | null;
  codigo_fabricante: string | null;
  /** Marca y, si hay, descripción: como se muestra en listas y lotes. */
  nombre: string;
  activo: boolean;
  proveedores: { id: number; nombre: string }[];
  /** Solo de un insumo aprobado y con la homologación vigente se reciben y consumen lotes. */
  estado_homologacion: EstadoHomologacion;
  /** Solo de una aprobada: hasta cuándo vale. */
  homologacion_vigente_hasta: string | null;
  /** Aprobada pero vencida: no se reciben ni se consumen sus lotes. */
  homologacion_vencida: boolean;
}

/** Se puede recibir y consumir: aprobada y sin vencer. */
export function homologacionVigente(insumo: Pick<Insumo, "estado_homologacion" | "homologacion_vencida">): boolean {
  return insumo.estado_homologacion === "aprobada" && !insumo.homologacion_vencida;
}

export interface InsumoInput {
  ingrediente_id: number;
  marca: string;
  descripcion: string | null;
  codigo_fabricante: string | null;
  proveedor_ids: number[];
}

/** El ingrediente no se cambia: los lotes ya recibidos quedarían incoherentes. */
export type InsumoCambios = Partial<Omit<InsumoInput, "ingrediente_id">> & { activo?: boolean };

/**
 * Homologación: el rótulo de la marca comparado con la especificación del
 * ingrediente (valores objetivo y alérgenos).
 */
export type EstadoHomologacion = "pendiente" | "aprobada" | "rechazada" | "requiere_revision";
export type ResultadoComparacion = "apta" | "observada" | "rechazada";
export type EstadoFila = "ok" | "fuera_de_tolerancia" | "sin_dato" | "sin_referencia" | "bajo_umbral";
export type NivelAlergenoRotulo = "contiene" | "puede_contener";

export const ETIQUETA_ESTADO_HOMOLOGACION: Record<EstadoHomologacion, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  requiere_revision: "Requiere revisión",
};

export const TONO_ESTADO_HOMOLOGACION = {
  pendiente: "neutro",
  aprobada: "ok",
  rechazada: "peligro",
  requiere_revision: "alerta",
} as const satisfies Record<EstadoHomologacion, "ok" | "alerta" | "peligro" | "info" | "neutro">;

export interface FilaComparacion {
  nutriente: string;
  nombre: string;
  unidad: string;
  referencia: string | null;
  rotulo: string | null;
  desvio_pct: string | null;
  estado: EstadoFila;
}

export interface FilaAlergenoComparacion {
  alergeno_id: number;
  nombre: string;
  nivel_ingrediente: NivelAlergenoRotulo | null;
  nivel_insumo: NivelAlergenoRotulo | null;
  cumple: boolean;
}

export interface ComparacionHomologacion {
  resultado: ResultadoComparacion;
  tolerancia_pct: string;
  nutrientes: FilaComparacion[];
  alergenos: FilaAlergenoComparacion[];
  problemas: string[];
}

export interface RotuloInsumo {
  referencia: string | null;
  /** Porción (g o ml) por la que declara el rótulo; null = por 100. */
  porcion: string | null;
  /** `valor` tal como figura en el rótulo; `valor_100`, convertido a 100 g/ml. */
  valores: { nutriente: string; valor: string; valor_100: string }[];
  alergenos: { alergeno_id: number; nombre: string; nivel: NivelAlergenoRotulo }[];
}

export interface HomologacionInsumo {
  insumo_id: number;
  insumo_nombre: string;
  ingrediente_id: number;
  ingrediente_nombre: string;
  es_aditivo: boolean;
  estado: EstadoHomologacion;
  /** Resultado de la comparación cuando se decidió (apta u observada). */
  resultado_al_decidir: ResultadoComparacion | null;
  justificacion: string | null;
  homologado_por: string | null;
  homologado_en: string | null;
  /** Hasta cuándo vale la aprobación; null si no está aprobada. */
  vigente_hasta: string | null;
  vencida: boolean;
  /** Tolerancia (%) con que se comparó al decidir; la actual puede ser otra. */
  tolerancia_al_decidir: string | null;
  rotulo: RotuloInsumo;
  comparacion: ComparacionHomologacion;
}

export interface RotuloInsumoInput {
  referencia: string | null;
  porcion: string | null;
  valores: { nutriente: string; valor: string }[];
  alergenos: { alergeno_id: number; nivel: NivelAlergenoRotulo }[];
}
