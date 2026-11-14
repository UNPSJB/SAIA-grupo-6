export interface UnidadMedidaInfo {
  id: number;
  nombre: string;
  simbolo: string;
}

import type { AditivoResumen } from "../../aditivos/types/aditivo";

/** E9: el insumo es ingrediente o aditivo (los productos tienen su propia tabla). */
export type TipoInsumo = "ingrediente" | "aditivo";

export const TIPOS_INSUMO: { valor: TipoInsumo; etiqueta: string }[] = [
  { valor: "ingrediente", etiqueta: "Ingrediente" },
  { valor: "aditivo", etiqueta: "Aditivo" },
];

export interface Insumo {
  id: number;
  nombre: string;
  unidad_medida_id: number;
  unidad_medida: UnidadMedidaInfo;
  activo: boolean;
  tipo: TipoInsumo;
  aditivo_id: number | null;
  /** Clase funcional, nombre completo e INS (solo aditivos). */
  aditivo: AditivoResumen | null;
  /** Densidad en g/ml. Obligatoria si la unidad es de tipo Volumen. */
  densidad_g_ml: number | null;
  /** Peso unitario en g. Obligatorio si la unidad es de tipo Unidad. */
  peso_unitario_g: number | null;
}

export interface InsumoFormValues {
  nombre: string;
  unidad_medida_id: number;
  tipo: TipoInsumo;
  aditivo_id: number | null;
  /** String para permitir vacío y coma decimal en el formulario. */
  densidad_g_ml: string;
  /** String para permitir vacío y coma decimal en el formulario. */
  peso_unitario_g: string;
}

/** Lo que el formulario entrega y la API recibe: los números ya parseados. */
export type InsumoInput = Omit<InsumoFormValues, "densidad_g_ml" | "peso_unitario_g"> & {
  densidad_g_ml: number | null;
  peso_unitario_g: number | null;
};
