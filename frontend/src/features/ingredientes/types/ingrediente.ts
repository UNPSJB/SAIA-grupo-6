export interface UnidadMedidaInfo {
  id: number;
  nombre: string;
  simbolo: string;
}

import type { AditivoResumen } from "../../aditivos/types/aditivo";

/**
 * Todo lo que entra en la receta es un ingrediente (CAA: "incluidos los
 * aditivos"); `es_aditivo` marca los que se declaran con clase funcional e INS.
 */

export interface Ingrediente {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadMedidaInfo;
  activo: boolean;
  es_aditivo: boolean;
  clase_funcional_id: number | null;
  numero_ins: string | null;
  /** Clase funcional e INS para mostrar (solo aditivos). */
  aditivo: AditivoResumen | null;
  /** Densidad en g/ml. Obligatoria si la unidad es de tipo Volumen. */
  densidad_g_ml: number | null;
  /** Peso unitario en g. Obligatorio si la unidad es de tipo Unidad. */
  peso_unitario_g: number | null;
  proveedores: { id: number; nombre: string; cuit: string | null }[];
}

export interface IngredienteFormValues {
  nombre: string;
  unidad_medida_id: number;
  es_aditivo: boolean;
  /** Solo aditivos. */
  clase_funcional_id: number | null;
  /** String para permitir vacío en el formulario. */
  numero_ins: string;
  /** String para permitir vacío y coma decimal en el formulario. */
  densidad_g_ml: string;
  /** String para permitir vacío y coma decimal en el formulario. */
  peso_unitario_g: string;
}

/** Lo que el formulario entrega y la API recibe: los números ya parseados. */
export type IngredienteInput = Omit<IngredienteFormValues, "densidad_g_ml" | "peso_unitario_g" | "numero_ins"> & {
  numero_ins: string | null;
  densidad_g_ml: number | null;
  peso_unitario_g: number | null;
};