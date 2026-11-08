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
}

export interface InsumoFormValues {
  nombre: string;
  unidad_medida_id: number;
  tipo: TipoInsumo;
  aditivo_id: number | null;
}
